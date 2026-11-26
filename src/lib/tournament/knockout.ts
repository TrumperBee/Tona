// GCC - knockout stage generation, reset, deciders and bracket progression.
//
// The organiser takes ONE action: "Generate knockout stage". In a single
// transaction the server re-reads the 144 league results, rebuilds and freezes
// the standings, proves every result exists, replays a server-generated seed
// through the pure engine, independently validates the whole 23-tie bracket and
// writes it. No client ever supplies a tie, a seed, a match id or a participant.
//
// Later rounds are stored as placeholders that name the tie feeding them. A
// result transaction writes a winner into those slots and creates the dependent
// matches; nothing is clock-driven and no away-goals rule applies.
import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { withPublicInvalidation } from "@/lib/cache/public-data";
import { requireTournamentOwnerOrSuperAdmin, type TournamentAccess } from "@/lib/auth/guards";
import {
  advanceBracket,
  applyDecider,
  awayUidForLeg,
  buildKnockoutBracket,
  dependentTieIds,
  homeUidForLeg,
  KNOCKOUT_ALGORITHM_VERSION,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_LABELS,
  resolveTie,
  validateBracket,
  type BracketSlot,
  type BracketTie,
  type KnockoutBracket,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutSlot,
  type ResolvableTie,
  type TieResolution,
} from "@/lib/engine";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { notify } from "@/lib/notifications/service";
import { finaliseTournamentCompletion } from "@/lib/stats/completion";
import { TournamentMutationError } from "@/lib/tournament/errors";
import {
  buildStandingsPlan,
  readStandingsContextInTransaction,
  stageStandingsWrites,
} from "@/lib/tournament/standings";
import type { KnockoutDecideInput } from "@/lib/validation/knockout";
import type {
  KnockoutTieDocument,
  KnockoutTieSlotDocument,
  TournamentDocument,
} from "@/types/domain";

const SEED_BYTES = 32;
const LEAGUE_MATCH_TOTAL = 144;
const PLAYER_COUNT = 36;
const TIE_TOTAL = 23;

export const KNOCKOUT_ROUND_ORDER: readonly KnockoutRound[] = KNOCKOUT_ROUNDS;

export function isKnockoutRound(value: unknown): value is KnockoutRound {
  return typeof value === "string" && KNOCKOUT_ROUND_ORDER.includes(value as KnockoutRound);
}

function newSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function roundIndex(round: KnockoutRound): number {
  return KNOCKOUT_ROUND_ORDER.indexOf(round);
}

/** Short, stable tie name used in messages: "Play-off A1", "R16 3", "Final". */
export function shortTieLabel(tieId: string): string {
  const playoff = /^playoff-([a-d])(\d)$/.exec(tieId);

  if (playoff) {
    return `Play-off ${playoff[1]?.toUpperCase()}${playoff[2]}`;
  }

  if (tieId === "final-1") {
    return "Final";
  }

  const other = /^(r16|qf|sf)-(\d+)$/.exec(tieId);

  if (other) {
    const prefix = other[1] === "r16" ? "R16" : (other[1]?.toUpperCase() ?? "");
    return `${prefix} ${other[2]}`;
  }

  return tieId;
}

/** Human label for a slot that has no known participant yet. */
export function slotSourceLabel(ref: KnockoutSlot): string {
  return ref.type === "seed" ? `Seed ${ref.seed}` : `Winner of ${shortTieLabel(ref.tieId)}`;
}

function readSlotRef(value: unknown): KnockoutSlot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (data.type === "seed" && typeof data.seed === "number" && Number.isInteger(data.seed)) {
    return { type: "seed", seed: data.seed };
  }

  if (data.type === "winnerOf" && typeof data.tieId === "string" && data.tieId.length > 0) {
    return { type: "winnerOf", tieId: data.tieId };
  }

  return null;
}

function readSlot(value: unknown): BracketSlot {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const ref = readSlotRef(data.ref) ?? { type: "seed", seed: 0 };
  const uid =
    typeof data.uid === "string" && data.uid.length > 0 && typeof data.position === "number"
      ? data.uid
      : null;
  const player: KnockoutPlayer | null =
    uid && typeof data.position === "number"
      ? {
          playerId: uid,
          position: data.position,
          gamerTag: typeof data.gamerTag === "string" ? data.gamerTag : undefined,
        }
      : null;

  return { ref, player };
}

export function slotDocument(slot: BracketSlot): KnockoutTieSlotDocument {
  return {
    ref: slot.ref,
    uid: slot.player?.playerId ?? null,
    gamerTag: slot.player?.gamerTag ?? null,
    position: slot.player?.position ?? null,
  };
}

function readGroup(value: unknown): BracketTie["group"] {
  return value === "A" || value === "B" || value === "C" || value === "D" ? value : null;
}

export interface StoredTie {
  readonly id: string;
  readonly ref: DocumentReference;
  readonly data: Record<string, unknown>;
  readonly tie: BracketTie;
}

/** Reads one stored tie document back into the pure engine shape. */
export function readStoredTie(
  id: string,
  ref: DocumentReference,
  data: Record<string, unknown>,
): StoredTie {
  const higher = readSlot(data.higher);
  const lower = readSlot(data.lower);
  const winnerUid = typeof data.winnerUid === "string" ? data.winnerUid : null;
  const winner =
    (higher.player?.playerId === winnerUid ? higher.player : null) ??
    (lower.player?.playerId === winnerUid ? lower.player : null);

  return {
    id,
    ref,
    data,
    tie: {
      tieId: readText(data.tieId, id),
      round: isKnockoutRound(data.round) ? data.round : "final",
      bracketSlot: typeof data.bracketSlot === "number" ? data.bracketSlot : 0,
      legs: data.legs === 1 ? 1 : 2,
      higher,
      lower,
      group: readGroup(data.group),
      winner,
    },
  };
}

function sortTies<T extends { readonly tie: BracketTie }>(ties: readonly T[]): T[] {
  return [...ties].sort((a, b) => {
    const delta = roundIndex(a.tie.round) - roundIndex(b.tie.round);
    return delta !== 0 ? delta : a.tie.bracketSlot - b.tie.bracketSlot;
  });
}

export interface KnockoutState {
  readonly tournament: TournamentDocument;
  readonly ties: readonly StoredTie[];
  readonly bracket: KnockoutBracket;
  readonly matches: readonly QueryDocumentSnapshot[];
}

/** Reads everything one knockout mutation needs, before any write. */
export async function readKnockoutState(
  transaction: Transaction,
  tournamentId: string,
): Promise<KnockoutState> {
  const firestore = getFirebaseAdminFirestore();
  const [tournamentSnapshot, tiesSnapshot, matchesSnapshot] = await Promise.all([
    transaction.get(firestore.doc(paths.tournament(tournamentId))),
    transaction.get(firestore.collection(paths.tournamentKnockoutTies(tournamentId))),
    transaction.get(firestore.collection(paths.tournamentMatches(tournamentId))),
  ]);

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as TournamentDocument;
  const ties = sortTies(
    tiesSnapshot.docs.map((document) => readStoredTie(document.id, document.ref, document.data())),
  );
  const bracket: KnockoutBracket = {
    seed: typeof tournament.knockoutSeed === "string" ? tournament.knockoutSeed : "",
    legs: tournament.knockoutLegs === 1 ? 1 : 2,
    ties: ties.map((entry) => entry.tie),
  };

  return { tournament, ties, bracket, matches: matchesSnapshot.docs };
}

export function knockoutMatchDocuments(
  matches: readonly QueryDocumentSnapshot[],
): readonly QueryDocumentSnapshot[] {
  return matches.filter((document) => {
    const stage = document.data().stage;
    return (
      stage === "playoff" ||
      stage === "r16" ||
      stage === "qf" ||
      stage === "sf" ||
      stage === "final"
    );
  });
}

/** Reads one stored leg match into the pure engine shape. */
export function readEngineMatch(data: Record<string, unknown>, fallbackLeg: number): KnockoutMatch {
  const result =
    typeof data.result === "object" && data.result !== null
      ? (data.result as Record<string, unknown>)
      : null;
  const hasResult = typeof result?.homeGoals === "number" && typeof result?.awayGoals === "number";

  return {
    leg: typeof data.leg === "number" ? data.leg : fallbackLeg,
    homeUid: readText(data.homeUid, ""),
    awayUid: readText(data.awayUid, ""),
    homeGoals: hasResult ? (result?.homeGoals as number) : null,
    awayGoals: hasResult ? (result?.awayGoals as number) : null,
  };
}

/**
 * The home-advantage rule expressed for the pure engine: the better league
 * position is the "higher seed". In a single match the better-ranked player
 * hosts; over two legs the lower-ranked player hosts the first leg.
 */
export function resolvableForTie(tie: BracketTie): ResolvableTie {
  const first = tie.higher.player;
  const second = tie.lower.player;

  if (!first || !second) {
    throw new TournamentMutationError(
      `Tie ${shortTieLabel(tie.tieId)} cannot be played before both participants are known.`,
      409,
    );
  }

  const [better, worse] = first.position < second.position ? [first, second] : [second, first];

  return {
    tieId: tie.tieId,
    legs: tie.legs,
    higherSeedUid: better.playerId,
    lowerSeedUid: worse.playerId,
  };
}

/** True when the structural `higher` slot holds the better-ranked player. */
function higherSlotIsBetter(tie: BracketTie): boolean {
  const first = tie.higher.player;
  const second = tie.lower.player;

  return !first || !second ? true : first.position < second.position;
}

/**
 * The engine resolves a tie by league rank, but stored aggregates and penalty
 * scores are keyed by the structural `higher`/`lower` slots so every view can
 * render a score next to the participant it belongs to. This converts one to
 * the other.
 */
export function slotAggregate(
  tie: BracketTie,
  resolution: TieResolution,
): { readonly higherGoals: number; readonly lowerGoals: number } {
  return higherSlotIsBetter(tie)
    ? resolution.aggregate
    : {
        higherGoals: resolution.aggregate.lowerGoals,
        lowerGoals: resolution.aggregate.higherGoals,
      };
}

export function slotPenalties(
  tie: BracketTie,
  penalties: { readonly higher: number; readonly lower: number } | null,
): { readonly higher: number; readonly lower: number } | null {
  if (!penalties) {
    return null;
  }

  return higherSlotIsBetter(tie) ? penalties : { higher: penalties.lower, lower: penalties.higher };
}

/** The stored fields that describe a tie's current result. */
export function tiePatchFromResolution(
  resolution: TieResolution,
  tie: BracketTie,
  now: Timestamp,
): Record<string, unknown> {
  return {
    status: resolution.status,
    aggregate: slotAggregate(tie, resolution),
    legsPlayed: resolution.legsPlayed,
    winnerUid: resolution.winnerUid,
    winnerPosition: resolution.winnerUid
      ? resolution.winnerUid === tie.higher.player?.playerId
        ? (tie.higher.player?.position ?? null)
        : (tie.lower.player?.position ?? null)
      : null,
    decidedBy: resolution.decidedBy,
    deciderNote: null,
    penalties: null,
    updatedAt: now,
  };
}

export function betterAndWorse(tie: BracketTie): {
  readonly better: KnockoutPlayer;
  readonly worse: KnockoutPlayer;
} {
  const first = tie.higher.player;
  const second = tie.lower.player;

  if (!first || !second) {
    throw new TournamentMutationError(
      `Tie ${shortTieLabel(tie.tieId)} needs two participants.`,
      409,
    );
  }

  return first.position < second.position
    ? { better: first, worse: second }
    : { better: second, worse: first };
}

function matchDocumentForTie(
  tournamentId: string,
  tie: BracketTie,
  leg: number,
  now: Timestamp,
): Record<string, unknown> {
  const resolvable = resolvableForTie(tie);
  const homeUid = homeUidForLeg(resolvable, leg);
  const awayUid = awayUidForLeg(resolvable, leg);
  const players = [tie.higher.player, tie.lower.player];

  return {
    tournamentId,
    stage: tie.round,
    matchday: 0,
    homeUid,
    awayUid,
    homeTag:
      players.find((player) => player?.playerId === homeUid)?.gamerTag ??
      (homeUid.slice(0, 12) || "Player"),
    awayTag:
      players.find((player) => player?.playerId === awayUid)?.gamerTag ??
      (awayUid.slice(0, 12) || "Player"),
    participants: [homeUid, awayUid],
    status: "scheduled",
    scheduledAt: null,
    result: null,
    tieId: tie.tieId,
    leg,
    updatedAt: now,
  };
}

export function tieToDocument(tie: BracketTie, now: Timestamp): Record<string, unknown> {
  return {
    tieId: tie.tieId,
    round: tie.round,
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    higher: slotDocument(tie.higher),
    lower: slotDocument(tie.lower),
    group: tie.group,
    status: "pending",
    aggregate: { higherGoals: 0, lowerGoals: 0 },
    legsPlayed: 0,
    winnerUid: null,
    winnerPosition: null,
    decidedBy: null,
    deciderNote: null,
    penalties: null,
    updatedAt: now,
  };
}

/** True when a stored tie has any result, including a decider. */
export function tieHasResult(tie: StoredTie): boolean {
  return (
    (typeof tie.data.legsPlayed === "number" && tie.data.legsPlayed > 0) ||
    tie.data.status === "completed" ||
    tie.data.status === "needs_decider"
  );
}

/** Names the first dependent tie that already has a result, if any. */
export function blockingDependentTie(
  state: Pick<KnockoutState, "bracket" | "ties">,
  tieId: string,
): StoredTie | null {
  const dependents = dependentTieIds(state.bracket, tieId);

  return state.ties.find((entry) => dependents.has(entry.id) && tieHasResult(entry)) ?? null;
}

export interface BracketAdvanceResult {
  readonly bracket: KnockoutBracket;
  readonly finalWinner: KnockoutPlayer | null;
  readonly createdMatches: number;
  readonly deletedMatches: number;
  /** The winner's next tie, once both of its players are known. */
  readonly readyForWinner: {
    readonly tieId: string;
    readonly round: string;
    readonly opponentUid: string;
    readonly opponentTag: string;
  } | null;
}

/**
 * Writes one tie winner (or its removal) into every dependent slot, deletes the
 * dependent leg matches that no longer describe a scheduled tie and creates the
 * matches for any tie that has just become playable. The caller has already
 * refused the change if a dependent tie held a result.
 */
export function stageBracketAdvance(input: {
  readonly transaction: Transaction;
  readonly firestore: Firestore;
  readonly tournamentId: string;
  readonly now: Timestamp;
  readonly before: KnockoutBracket;
  readonly ties: readonly StoredTie[];
  readonly matches: readonly QueryDocumentSnapshot[];
  readonly changedTieId: string;
  readonly winner: KnockoutPlayer | null;
}): BracketAdvanceResult {
  const { transaction, firestore, tournamentId, now, before, ties, matches } = input;
  const after = advanceBracket(before, { tieId: input.changedTieId, winner: input.winner });
  const beforeById = new Map(before.ties.map((tie) => [tie.tieId, tie] as const));
  const storedById = new Map(ties.map((tie) => [tie.id, tie] as const));
  const matchesByTie = new Map<string, QueryDocumentSnapshot[]>();

  for (const document of matches) {
    const tieId = document.data().tieId;

    if (typeof tieId !== "string") {
      continue;
    }

    const list = matchesByTie.get(tieId) ?? [];
    list.push(document);
    matchesByTie.set(tieId, list);
  }

  let createdMatches = 0;
  let deletedMatches = 0;
  const participantsChanged = new Set<string>();

  for (const tie of after.ties) {
    if (tie.tieId === input.changedTieId) {
      continue;
    }

    const previous = beforeById.get(tie.tieId);
    const stored = storedById.get(tie.tieId);

    if (!previous || !stored) {
      continue;
    }

    const changed =
      previous.higher.player?.playerId !== tie.higher.player?.playerId ||
      previous.lower.player?.playerId !== tie.lower.player?.playerId;

    if (!changed) {
      continue;
    }

    participantsChanged.add(tie.tieId);
    const existing = matchesByTie.get(tie.tieId) ?? [];

    for (const document of existing) {
      transaction.delete(document.ref);
      deletedMatches += 1;
    }

    transaction.update(stored.ref, {
      higher: slotDocument(tie.higher),
      lower: slotDocument(tie.lower),
      status: "pending",
      aggregate: { higherGoals: 0, lowerGoals: 0 },
      legsPlayed: 0,
      winnerUid: null,
      winnerPosition: null,
      decidedBy: null,
      deciderNote: null,
      penalties: null,
      updatedAt: now,
    });
  }

  for (const tie of after.ties) {
    if (tie.tieId === input.changedTieId) {
      continue;
    }

    if (!tie.higher.player || !tie.lower.player) {
      continue;
    }

    const existing = matchesByTie.get(tie.tieId) ?? [];

    if (existing.length > 0 && !participantsChanged.has(tie.tieId)) {
      continue;
    }

    for (let leg = 1; leg <= tie.legs; leg += 1) {
      transaction.set(
        firestore.doc(paths.tournamentMatch(tournamentId, `${tie.tieId}-l${leg}`)),
        matchDocumentForTie(tournamentId, tie, leg, now),
      );
      createdMatches += 1;
    }
  }

  const finalTie = after.ties.find((tie) => tie.round === "final") ?? null;

  const winnerId = input.winner?.playerId ?? null;
  const nextTie =
    winnerId === null
      ? null
      : (after.ties.find(
          (tie) =>
            tie.tieId !== input.changedTieId &&
            tie.higher.player &&
            tie.lower.player &&
            (tie.higher.player.playerId === winnerId || tie.lower.player.playerId === winnerId),
        ) ?? null);
  const opponent =
    nextTie && winnerId
      ? nextTie.higher.player?.playerId === winnerId
        ? nextTie.lower.player
        : nextTie.higher.player
      : null;

  return {
    bracket: after,
    finalWinner: finalTie?.winner ?? null,
    createdMatches,
    deletedMatches,
    readyForWinner:
      nextTie && opponent
        ? {
            tieId: nextTie.tieId,
            round: nextTie.round,
            opponentUid: opponent.playerId,
            opponentTag: opponent.gamerTag ?? "your opponent",
          }
        : null,
  };
}

/** Stable SHA-256 over the generated bracket's structure and participants. */
export function bracketHash(bracket: KnockoutBracket): string {
  const canonical = sortTies(bracket.ties.map((tie) => ({ tie }))).map(({ tie }) => ({
    tieId: tie.tieId,
    round: tie.round,
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    higher: { ref: tie.higher.ref, uid: tie.higher.player?.playerId ?? null },
    lower: { ref: tie.lower.ref, uid: tie.lower.player?.playerId ?? null },
    group: tie.group,
  }));

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export interface OrganiserKnockoutSlotView {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly position: number | null;
  /** What the slot means before it is resolved, e.g. "Winner of R16 3". */
  readonly source: string;
}

export interface OrganiserKnockoutMatchView {
  readonly id: string;
  readonly leg: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly status: "scheduled" | "completed";
}

export interface OrganiserKnockoutTieView {
  readonly tieId: string;
  readonly round: KnockoutRound;
  readonly roundLabel: string;
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly group: string | null;
  readonly higher: OrganiserKnockoutSlotView;
  readonly lower: OrganiserKnockoutSlotView;
  readonly status: KnockoutTieDocument["status"];
  readonly aggregate: KnockoutTieDocument["aggregate"];
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly winnerTag: string | null;
  readonly decidedBy: KnockoutTieDocument["decidedBy"];
  readonly deciderNote: string | null;
  readonly penalties: KnockoutTieDocument["penalties"];
  readonly matches: readonly OrganiserKnockoutMatchView[];
  readonly complete: boolean;
}

export interface OrganiserKnockoutView {
  readonly tournament: TournamentDocument;
  readonly ties: readonly OrganiserKnockoutTieView[];
  readonly leagueMatchesCompleted: number;
  readonly leagueMatchesTotal: number;
  readonly generated: boolean;
  readonly seed: string | null;
  readonly legs: KnockoutLegs | null;
  readonly bracketHash: string | null;
  readonly championUid: string | null;
  readonly championTag: string | null;
  readonly runnerUpUid: string | null;
  readonly runnerUpTag: string | null;
  readonly qualifiers: {
    readonly direct: number;
    readonly playoff: number;
    readonly eliminated: number;
  };
}

function readSlotView(slot: BracketSlot): OrganiserKnockoutSlotView {
  return {
    uid: slot.player?.playerId ?? null,
    gamerTag: slot.player?.gamerTag ?? null,
    position: slot.player?.position ?? null,
    source: slotSourceLabel(slot.ref),
  };
}

function readTieStatus(value: unknown): KnockoutTieDocument["status"] {
  return value === "in_progress" || value === "needs_decider" || value === "completed"
    ? value
    : "pending";
}

/** Guarded read for the organiser knockout workspace. */
export async function getOrganiserKnockout(tournamentId: string): Promise<OrganiserKnockoutView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const [tiesSnapshot, matchesSnapshot, standingsSnapshot] = await Promise.all([
    firestore.collection(paths.tournamentKnockoutTies(tournamentId)).get(),
    firestore.collection(paths.tournamentMatches(tournamentId)).get(),
    firestore.collection(paths.tournamentStandings(tournamentId)).get(),
  ]);

  const matchesByTie = new Map<string, OrganiserKnockoutMatchView[]>();

  for (const document of matchesSnapshot.docs) {
    const data = document.data();

    if (typeof data.tieId !== "string") {
      continue;
    }

    const result =
      typeof data.result === "object" && data.result !== null
        ? (data.result as Record<string, unknown>)
        : null;
    const list = matchesByTie.get(data.tieId) ?? [];

    list.push({
      id: document.id,
      leg: typeof data.leg === "number" ? data.leg : 1,
      homeUid: readText(data.homeUid, ""),
      awayUid: readText(data.awayUid, ""),
      homeTag: readText(data.homeTag, "Player"),
      awayTag: readText(data.awayTag, "Player"),
      homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
      awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
      status: data.status === "completed" ? "completed" : "scheduled",
    });
    matchesByTie.set(data.tieId, list);
  }

  const ties = sortTies(
    tiesSnapshot.docs.map((document) => readStoredTie(document.id, document.ref, document.data())),
  ).map((entry): OrganiserKnockoutTieView => {
    const { tie, data } = entry;
    const matches = (matchesByTie.get(tie.tieId) ?? []).sort((a, b) => a.leg - b.leg);
    const status = readTieStatus(data.status);

    return {
      tieId: tie.tieId,
      round: tie.round,
      roundLabel: KNOCKOUT_ROUND_LABELS[tie.round],
      bracketSlot: tie.bracketSlot,
      legs: tie.legs,
      group: tie.group,
      higher: readSlotView(tie.higher),
      lower: readSlotView(tie.lower),
      status,
      aggregate:
        typeof data.aggregate === "object" && data.aggregate !== null
          ? {
              higherGoals: Number((data.aggregate as { higherGoals?: unknown }).higherGoals ?? 0),
              lowerGoals: Number((data.aggregate as { lowerGoals?: unknown }).lowerGoals ?? 0),
            }
          : { higherGoals: 0, lowerGoals: 0 },
      legsPlayed: typeof data.legsPlayed === "number" ? data.legsPlayed : 0,
      winnerUid: tie.winner?.playerId ?? null,
      winnerTag: tie.winner?.gamerTag ?? null,
      decidedBy:
        data.decidedBy === "aggregate" ||
        data.decidedBy === "extra_time" ||
        data.decidedBy === "penalties"
          ? data.decidedBy
          : null,
      deciderNote: typeof data.deciderNote === "string" ? data.deciderNote : null,
      penalties:
        typeof data.penalties === "object" && data.penalties !== null
          ? {
              higher: Number((data.penalties as { higher?: unknown }).higher ?? 0),
              lower: Number((data.penalties as { lower?: unknown }).lower ?? 0),
            }
          : null,
      matches,
      complete: status === "completed" && tie.winner !== null,
    };
  });

  const tags = new Map<string, string>();

  for (const document of standingsSnapshot.docs) {
    const tag = document.data().gamerTag;

    if (typeof tag === "string" && tag.length > 0) {
      tags.set(document.id, tag);
    }
  }

  const leagueMatchesCompleted = matchesSnapshot.docs.filter((document) => {
    const data = document.data();
    return data.stage === "league" && data.status === "completed";
  }).length;
  const positions = standingsSnapshot.docs
    .map((document) => document.data().position)
    .filter((position): position is number => typeof position === "number");
  const seed =
    typeof access.tournament.knockoutSeed === "string" ? access.tournament.knockoutSeed : null;

  return {
    tournament: access.tournament,
    ties,
    leagueMatchesCompleted,
    leagueMatchesTotal: LEAGUE_MATCH_TOTAL,
    generated: ties.length === TIE_TOTAL,
    seed,
    legs:
      access.tournament.knockoutLegs === 1 ? 1 : access.tournament.knockoutLegs === 2 ? 2 : null,
    bracketHash: access.tournament.knockoutBracketHash ?? null,
    championUid: access.tournament.championUid ?? null,
    championTag: access.tournament.championUid
      ? (tags.get(access.tournament.championUid) ?? null)
      : null,
    runnerUpUid: access.tournament.runnerUpUid ?? null,
    runnerUpTag: access.tournament.runnerUpUid
      ? (tags.get(access.tournament.runnerUpUid) ?? null)
      : null,
    qualifiers: {
      direct: positions.filter((position) => position >= 1 && position <= 8).length,
      playoff: positions.filter((position) => position >= 9 && position <= 24).length,
      eliminated: positions.filter((position) => position >= 25).length,
    },
  };
}

export interface GenerateKnockoutResult {
  readonly generated: boolean;
  readonly seed: string;
  readonly legs: KnockoutLegs;
  readonly tieCount: number;
  readonly matchCount: number;
}

/**
 * The single knockout generation action. It is idempotent: a second call for an
 * already-generated bracket returns the stored summary and writes nothing.
 */
async function generateKnockoutStageWrite(
  tournamentId: string,
  legs: KnockoutLegs,
): Promise<GenerateKnockoutResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));
  const seed = newSeed();
  const now = Timestamp.now();

  const result = await firestore.runTransaction(async (transaction) => {
    const context = await readStandingsContextInTransaction(transaction, tournamentId);
    const tournament = context.tournament;
    const tiesSnapshot = await transaction.get(tiesRef);

    if (tiesSnapshot.size === TIE_TOTAL) {
      const existingSeed =
        typeof tournament.knockoutSeed === "string" ? tournament.knockoutSeed : "";

      if (existingSeed.length === 0) {
        throw new TournamentMutationError(
          "The stored bracket is incomplete. Reset it before generating again.",
          409,
        );
      }

      const matchesSnapshot = await transaction.get(
        firestore.collection(paths.tournamentMatches(tournamentId)),
      );

      return {
        generated: false,
        seed: existingSeed,
        legs:
          tournament.knockoutLegs === 1
            ? (1 as const)
            : ((tournament.knockoutLegs ?? legs) as KnockoutLegs),
        tieCount: TIE_TOTAL,
        matchCount: matchesSnapshot.docs.filter(
          (document) =>
            document.data().stage !== "league" && document.data().status === "scheduled",
        ).length,
        hash: tournament.knockoutBracketHash ?? "",
        playerIds: [],
        championUid: tournament.championUid ?? null,
        tournamentName: tournament.name,
        slug: tournament.slug,
      };
    }

    if (tiesSnapshot.size > 0) {
      throw new TournamentMutationError(
        "The stored bracket is incomplete. Reset it before generating again.",
        409,
      );
    }

    if (tournament.status !== "league_phase") {
      throw new TournamentMutationError(
        "Generate the knockout stage only while the league phase is running.",
        409,
      );
    }

    const leagueMatches = context.matchDocs.filter(
      (document) => document.data().stage === "league",
    );

    if (leagueMatches.length !== LEAGUE_MATCH_TOTAL) {
      throw new TournamentMutationError(
        `Generate the knockout stage only after all ${LEAGUE_MATCH_TOTAL} league matches exist; found ${leagueMatches.length}.`,
        409,
      );
    }

    const incomplete = leagueMatches.filter(
      (document) => document.data().status !== "completed",
    ).length;

    if (incomplete > 0) {
      throw new TournamentMutationError(
        `Record all league results first. ${incomplete} match${incomplete === 1 ? " is" : "es are"} still without a result.`,
        409,
      );
    }

    // Rebuild the table from the stored results so the bracket uses the exact
    // ordering this transaction freezes, not a cached projection.
    const plan = buildStandingsPlan(context.source, new Map(), now);
    const identities = new Map(plan.players.map((player) => [player.uid, player] as const));
    const players: KnockoutPlayer[] = plan.rows.map((row) => {
      const identity = identities.get(row.id);

      if (!identity) {
        throw new TournamentMutationError("A standings row has no player identity.", 500);
      }

      return {
        playerId: row.id,
        position: row.position,
        gamerTag: identity.gamerTag,
      };
    });

    if (players.length !== PLAYER_COUNT) {
      throw new TournamentMutationError(
        `The knockout needs all ${PLAYER_COUNT} league positions; found ${players.length}.`,
        409,
      );
    }

    let bracket: KnockoutBracket;

    try {
      bracket = buildKnockoutBracket({
        standings: players,
        seed,
        legs,
      });
    } catch (error) {
      throw new TournamentMutationError(
        error instanceof Error ? error.message : "The knockout draw failed.",
        409,
      );
    }

    const validation = validateBracket(bracket);

    if (!validation.valid) {
      throw new TournamentMutationError(
        `The generated bracket is invalid: ${validation.issues.map((issue) => issue.message).join(" ")}`,
        500,
      );
    }

    let matchCount = 0;

    for (const tie of bracket.ties) {
      transaction.set(
        firestore.doc(paths.tournamentKnockoutTie(tournamentId, tie.tieId)),
        tieToDocument(tie, now),
      );

      if (!tie.higher.player || !tie.lower.player) {
        continue;
      }

      for (let leg = 1; leg <= tie.legs; leg += 1) {
        const matchId = `${tie.tieId}-l${leg}`;
        transaction.set(
          firestore.doc(paths.tournamentMatch(tournamentId, matchId)),
          matchDocumentForTie(tournamentId, tie, leg, now),
        );
        matchCount += 1;
      }
    }

    stageStandingsWrites(transaction, tournamentId, plan);
    const hash = bracketHash(bracket);
    transaction.update(tournamentRef, {
      status: "knockout",
      leaguePhaseClosedAt: now,
      knockoutLegs: legs,
      knockoutSeed: seed,
      knockoutAlgorithmVersion: KNOCKOUT_ALGORITHM_VERSION,
      knockoutBracketHash: hash,
      knockoutGeneratedAt: now,
      leagueMatchesCompleted: LEAGUE_MATCH_TOTAL,
      standingsUpdatedAt: now,
      championUid: null,
      runnerUpUid: null,
      completedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      generated: true,
      seed,
      legs,
      tieCount: bracket.ties.length,
      matchCount,
      hash,
      playerIds: players.map((player) => player.playerId),
      championUid: null,
      tournamentName: tournament.name,
      slug: tournament.slug,
    };
  });

  if (result.generated) {
    await writeAuditLog({
      actorUid: access.user.userId,
      actorRole: access.user.role,
      action: "tournament.knockout.generated",
      targetType: "tournament",
      targetId: tournamentId,
      tournamentId,
      before: { status: "league_phase" },
      after: {
        status: "knockout",
        seed: result.seed,
        legs: result.legs,
        tieCount: result.tieCount,
        matchCount: result.matchCount,
        algorithmVersion: KNOCKOUT_ALGORITHM_VERSION,
        bracketHash: result.hash,
      },
    });

    const link = `/tournaments/${result.slug}`;

    await notify({
      recipients: result.playerIds,
      type: "knockout_qualified",
      title: "The knockout bracket is live",
      body: `${result.tournamentName}: the league table is frozen and every knockout tie is published. Check your path to the final.`,
      link,
      email: {
        heading: "The knockout bracket is live",
        paragraphs: [
          `${result.tournamentName}: the league table is frozen and every knockout tie is published.`,
          "Check your path to the final and your first knockout opponent.",
        ],
        buttonLabel: "View the bracket",
      },
    }).catch(() => undefined);
  }

  return {
    generated: result.generated,
    seed: result.seed,
    legs: result.legs,
    tieCount: result.tieCount,
    matchCount: result.matchCount,
  };
}

/** Deletes a generated bracket that has no knockout result yet. */
async function resetKnockoutStageWrite(
  tournamentId: string,
  reason: string | undefined,
): Promise<{ readonly deletedTies: number; readonly deletedMatches: number }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));

  const result = await firestore.runTransaction(async (transaction) => {
    const [tournamentSnapshot, tiesSnapshot, matchesSnapshot] = await Promise.all([
      transaction.get(tournamentRef),
      transaction.get(tiesRef),
      transaction.get(firestore.collection(paths.tournamentMatches(tournamentId))),
    ]);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "knockout") {
      throw new TournamentMutationError("There is no running knockout stage to reset.", 409);
    }

    if (tiesSnapshot.size !== TIE_TOTAL) {
      throw new TournamentMutationError(
        "The stored bracket is incomplete. Contact the Super Admin.",
        409,
      );
    }

    const ties = tiesSnapshot.docs.map((document) =>
      readStoredTie(document.id, document.ref, document.data()),
    );
    const withResult = ties.find((tie) => tieHasResult(tie));

    if (withResult) {
      throw new TournamentMutationError(
        `The knockout has a recorded result in ${shortTieLabel(withResult.id)}. Reset is only possible before any knockout result exists.`,
        409,
      );
    }

    const knockoutMatches = knockoutMatchDocuments(matchesSnapshot.docs);
    const completed = knockoutMatches.find(
      (document) => document.data().status === "completed" || document.data().result !== null,
    );

    if (completed) {
      throw new TournamentMutationError(
        "The knockout has a recorded leg result. Reset is only possible before any knockout result exists.",
        409,
      );
    }

    for (const tie of ties) {
      transaction.delete(tie.ref);
    }

    for (const document of knockoutMatches) {
      transaction.delete(document.ref);
    }

    transaction.update(tournamentRef, {
      status: "league_phase",
      leaguePhaseClosedAt: null,
      knockoutLegs: null,
      knockoutSeed: null,
      knockoutAlgorithmVersion: null,
      knockoutBracketHash: null,
      knockoutGeneratedAt: null,
      championUid: null,
      runnerUpUid: null,
      completedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { deletedTies: ties.length, deletedMatches: knockoutMatches.length };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.knockout.reset",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: "knockout" },
    after: {
      status: "league_phase",
      deletedTies: result.deletedTies,
      deletedMatches: result.deletedMatches,
    },
    reason: reason ?? null,
  });

  return result;
}

/** Applies an organiser decider to a level tie and advances the bracket. */
async function decideKnockoutTieWrite(
  tournamentId: string,
  tieId: string,
  input: KnockoutDecideInput,
): Promise<{ readonly winnerUid: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();

  const decided = await firestore.runTransaction(async (transaction) => {
    const state = await readKnockoutState(transaction, tournamentId);

    if (state.tournament.status !== "knockout") {
      throw new TournamentMutationError("The knockout is not running.", 409);
    }

    const stored = state.ties.find((tie) => tie.id === tieId);

    if (!stored) {
      throw new TournamentMutationError("Knockout tie not found.", 404);
    }

    if (!stored.tie.higher.player || !stored.tie.lower.player) {
      throw new TournamentMutationError("That tie has no participants yet.", 409);
    }

    const legMatches = state.matches.filter((document) => document.data().tieId === tieId);
    const engineMatches = legMatches.map((document) => readEngineMatch(document.data(), 0));
    const resolvable = resolvableForTie(stored.tie);
    const resolution = resolveTie(resolvable, engineMatches);

    if (resolution.status !== "needs_decider") {
      throw new TournamentMutationError(
        "A decider is only possible when the tie is level after every leg.",
        409,
      );
    }

    const decider: KnockoutDecider = {
      winnerUid: input.winnerUid,
      method: input.method,
      note: input.note ?? null,
      penalties: input.penalties ?? null,
    };
    let completed: TieResolution;

    try {
      completed = applyDecider(resolution, resolvable, decider);
    } catch (error) {
      throw new TournamentMutationError(
        error instanceof Error ? error.message : "The decider is invalid.",
        400,
      );
    }

    if (!completed.winnerUid) {
      throw new TournamentMutationError("The decider did not produce a winner.", 500);
    }

    const { better, worse } = betterAndWorse(stored.tie);
    const now = Timestamp.now();
    const patch = tiePatchFromResolution(completed, stored.tie, now);
    const winner = completed.winnerUid === better.playerId ? better : worse;

    // A decider on the final completes the tournament in the same transaction.
    // Read the registrations and memberships before the first write.
    const completionTargets =
      stored.tie.round === "final" ? await readCompletionTargets(transaction, tournamentId) : null;

    transaction.update(stored.ref, {
      ...patch,
      status: "completed",
      decidedBy: decider.method,
      deciderNote: decider.note,
      penalties: slotPenalties(stored.tie, decider.penalties),
    });

    const advanced = stageBracketAdvance({
      transaction,
      firestore,
      tournamentId,
      now,
      before: state.bracket,
      ties: state.ties,
      matches: state.matches,
      changedTieId: tieId,
      winner,
    });
    let completion: CompletionSummary | null = null;

    if (completionTargets && advanced.finalWinner) {
      const finalTie = advanced.bracket.ties.find((tie) => tie.round === "final") ?? null;

      if (finalTie) {
        completion = stageTournamentCompletion({
          transaction,
          tournamentRef: firestore.doc(paths.tournament(tournamentId)),
          finalTie,
          registeredUids: completionTargets.registeredUids,
          membershipSnapshots: completionTargets.membershipSnapshots,
          now,
        });
      }
    }

    return {
      winnerUid: winner.playerId,
      round: stored.tie.round,
      tournament: state.tournament,
      completion,
    };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.knockout.decided",
    targetType: "knockoutTie",
    targetId: `${tournamentId}/${tieId}`,
    tournamentId,
    before: { status: "needs_decider" },
    after: {
      round: decided.round,
      winnerUid: decided.winnerUid,
      method: input.method,
      penalties: input.penalties ?? null,
      note: input.note ?? null,
    },
    reason: input.note ?? null,
  });

  if (decided.completion) {
    await announceCompletion(access, tournamentId, decided.tournament, decided.completion);
    await finaliseTournamentCompletion(tournamentId).catch(() => undefined);
  }

  return { winnerUid: decided.winnerUid };
}

export interface CompletionSummary {
  readonly championUid: string;
  readonly runnerUpUid: string;
  readonly championTag: string;
  readonly runnerUpTag: string;
}

export function completionFromTie(tie: BracketTie): CompletionSummary | null {
  if (!tie.winner || !tie.higher.player || !tie.lower.player) {
    return null;
  }

  const runnerUp =
    tie.winner.playerId === tie.higher.player.playerId ? tie.lower.player : tie.higher.player;

  return {
    championUid: tie.winner.playerId,
    runnerUpUid: runnerUp.playerId,
    championTag: tie.winner.gamerTag ?? "Champion",
    runnerUpTag: runnerUp.gamerTag ?? "Runner-up",
  };
}

/**
 * Marks the tournament complete and every membership finished. Called only
 * after the final has a winner, inside the same transaction that recorded it.
 */
export function stageTournamentCompletion(input: {
  readonly transaction: Transaction;
  readonly tournamentRef: DocumentReference;
  readonly finalTie: BracketTie;
  readonly registeredUids: readonly string[];
  readonly membershipSnapshots: readonly DocumentSnapshot[];
  readonly now: Timestamp;
}): CompletionSummary | null {
  const summary = completionFromTie(input.finalTie);

  if (!summary) {
    return null;
  }

  input.membershipSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() ?? {};
    input.transaction.update(snapshot.ref, {
      status: "completed",
      playerStatus: data.playerStatus ?? data.status ?? "registered",
      updatedAt: input.now,
    });
  });

  input.transaction.update(input.tournamentRef, {
    status: "completed",
    championUid: summary.championUid,
    runnerUpUid: summary.runnerUpUid,
    completedAt: input.now,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return summary;
}

/** Reopens a completed tournament when a Super Admin clears its final winner. */
export function stageTournamentReopen(input: {
  readonly transaction: Transaction;
  readonly tournamentRef: DocumentReference;
  readonly now: Timestamp;
}): void {
  input.transaction.update(input.tournamentRef, {
    status: "knockout",
    championUid: null,
    runnerUpUid: null,
    completedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function readCompletionTargets(
  transaction: Transaction,
  tournamentId: string,
): Promise<{
  readonly registeredUids: readonly string[];
  readonly membershipSnapshots: readonly DocumentSnapshot[];
}> {
  const firestore = getFirebaseAdminFirestore();
  const registrationsSnapshot = await transaction.get(
    firestore
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered"),
  );
  const registeredUids = registrationsSnapshot.docs.map((document) => document.id);
  const membershipSnapshots = await Promise.all(
    registeredUids.map((uid) =>
      transaction.get(firestore.doc(paths.userMembership(uid, tournamentId))),
    ),
  );

  return { registeredUids, membershipSnapshots };
}

/** Post-transaction completion side effects: audit plus a message to everyone. */
async function announceCompletionWrite(
  access: TournamentAccess,
  tournamentId: string,
  tournament: TournamentDocument,
  summary: CompletionSummary,
): Promise<void> {
  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.completed",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: "knockout" },
    after: {
      status: "completed",
      championUid: summary.championUid,
      runnerUpUid: summary.runnerUpUid,
    },
  });

  const firestore = getFirebaseAdminFirestore();
  const registrations = await firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered")
    .get();

  await notify({
    recipients: registrations.docs.map((document) => document.id),
    type: "tournament_completed",
    title: `${tournament.name} is complete`,
    body: `${summary.championTag} is the champion. The final result and the frozen league table are on the tournament page.`,
    link: `/tournaments/${tournament.slug}`,
    email: {
      heading: `${tournament.name} is complete`,
      paragraphs: [
        `${summary.championTag} is the champion.`,
        "The final result, the frozen league table and your tournament record are on the tournament page.",
      ],
      bullets: [`Champion: ${summary.championTag}`],
      buttonLabel: "View the final standings",
    },
  }).catch(() => undefined);
}

export const generateKnockoutStage = withPublicInvalidation(generateKnockoutStageWrite);
export const resetKnockoutStage = withPublicInvalidation(resetKnockoutStageWrite);
export const decideKnockoutTie = withPublicInvalidation(decideKnockoutTieWrite);
export const announceCompletion = withPublicInvalidation(announceCompletionWrite);
