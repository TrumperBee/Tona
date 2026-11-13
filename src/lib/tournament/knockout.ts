// GCC - knockout draw, publication, deciders and completion.
//
// Every mutation re-reads the tournament, the relevant ties and the draft in a
// single Firestore transaction. The client never supplies a tie, a seed or a
// match id; the server generates the seed and replays it through the pure
// engine, then validates the result independently before storing anything.
//
// The league table is frozen when the league phase closes: later knockout
// results never rebuild standings.
import "server-only";

import { randomBytes } from "node:crypto";

import { FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import {
  applyDecider,
  buildNextRound,
  buildPlayoffTies,
  buildRoundOf16Ties,
  DEFAULT_KNOCKOUT_CONFIG,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUND_TIE_COUNTS,
  nextRoundFor,
  resolveTie,
  validateKnockoutRound,
  validateProgression,
  winnerPosition,
  type KnockoutConfig,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutTie,
  type PlayoffWinner,
  type TieResolution,
} from "@/lib/engine";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotifications } from "@/lib/notifications";
import { TournamentMutationError } from "@/lib/tournament/errors";
import type { KnockoutDecideInput } from "@/lib/validation/knockout";
import type { KnockoutDraftTie, KnockoutTieDocument, TournamentDocument } from "@/types/domain";

const SEED_BYTES = 32;
const LEAGUE_MATCH_TOTAL = 144;
const PLAYER_COUNT = 36;

export const KNOCKOUT_ROUND_ORDER: readonly KnockoutRound[] = KNOCKOUT_ROUNDS;

export function roundIndex(round: KnockoutRound): number {
  return KNOCKOUT_ROUND_ORDER.indexOf(round);
}

export function previousKnockoutRound(round: KnockoutRound): KnockoutRound | null {
  const index = roundIndex(round);
  return index > 0 ? (KNOCKOUT_ROUND_ORDER[index - 1] ?? null) : null;
}

function newSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function isKnockoutRound(value: unknown): value is KnockoutRound {
  return typeof value === "string" && KNOCKOUT_ROUND_ORDER.includes(value as KnockoutRound);
}

export function normaliseConfig(value: unknown): KnockoutConfig {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const leg = (round: KnockoutRound): KnockoutLegs =>
    data[round] === 1 || data[round] === 2
      ? (data[round] as KnockoutLegs)
      : DEFAULT_KNOCKOUT_CONFIG[round];

  return {
    playoff: leg("playoff"),
    r16: leg("r16"),
    qf: leg("qf"),
    sf: leg("sf"),
    final: 1,
  };
}

interface StoredMatch {
  readonly result: { readonly homeGoals: number; readonly awayGoals: number } | null;
}

function readStoredResult(value: unknown): StoredMatch["result"] {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  return typeof data.homeGoals === "number" && typeof data.awayGoals === "number"
    ? { homeGoals: data.homeGoals, awayGoals: data.awayGoals }
    : null;
}

/** A stored tie plus its persisted status, which the pure engine does not own. */
export type StoredKnockoutTie = KnockoutTie & {
  readonly status: KnockoutTieDocument["status"];
};

function readTieStatus(value: unknown): KnockoutTieDocument["status"] {
  return value === "in_progress" || value === "needs_decider" || value === "completed"
    ? value
    : "pending";
}

/** Reads a stored tie document back into the pure engine shape. */
export function readEngineTie(data: Record<string, unknown>): StoredKnockoutTie {
  return {
    tieId: readText(data.tieId, ""),
    round: isKnockoutRound(data.round) ? data.round : "final",
    bracketSlot: typeof data.bracketSlot === "number" ? data.bracketSlot : 0,
    legs: data.legs === 1 ? 1 : 2,
    higherSeedUid: readText(data.higherSeedUid, ""),
    lowerSeedUid: readText(data.lowerSeedUid, ""),
    higherSeedPosition: typeof data.higherSeedPosition === "number" ? data.higherSeedPosition : 0,
    lowerSeedPosition: typeof data.lowerSeedPosition === "number" ? data.lowerSeedPosition : 0,
    group:
      data.group === "A" || data.group === "B" || data.group === "C" || data.group === "D"
        ? data.group
        : null,
    sourceTieIds: Array.isArray(data.sourceTieIds)
      ? data.sourceTieIds.filter((id): id is string => typeof id === "string")
      : [],
    winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : null,
    winnerPosition: typeof data.winnerPosition === "number" ? data.winnerPosition : null,
    status: readTieStatus(data.status),
  };
}

/** Reads a stored leg match into the pure engine match shape. */
export function readEngineMatch(data: Record<string, unknown>, fallbackLeg: number): KnockoutMatch {
  const result = readStoredResult(data.result);

  return {
    leg: typeof data.leg === "number" ? data.leg : fallbackLeg,
    homeUid: readText(data.homeUid, ""),
    awayUid: readText(data.awayUid, ""),
    homeGoals: result?.homeGoals ?? null,
    awayGoals: result?.awayGoals ?? null,
  };
}

/**
 * The tie patch derived from a resolution. A level tie is stored as
 * `needs_decider` with no winner; any new result clears a previous decider
 * until the organiser records a fresh one.
 */
export function tiePatchFromResolution(
  resolution: TieResolution,
  tie: Pick<
    KnockoutTie,
    "higherSeedUid" | "lowerSeedUid" | "higherSeedPosition" | "lowerSeedPosition"
  >,
  now: Timestamp,
): Record<string, unknown> {
  return {
    status: resolution.status,
    aggregate: resolution.aggregate,
    legsPlayed: resolution.legsPlayed,
    winnerUid: resolution.winnerUid,
    winnerPosition: resolution.winnerUid
      ? resolution.winnerUid === tie.higherSeedUid
        ? tie.higherSeedPosition
        : tie.lowerSeedPosition
      : null,
    decidedBy: resolution.decidedBy,
    deciderNote: null,
    penalties: null,
    updatedAt: now,
  };
}

function readStandingsPlayers(
  snapshot: QuerySnapshot,
): Map<string, { readonly position: number; readonly gamerTag: string }> {
  const players = new Map<string, { position: number; gamerTag: string }>();

  for (const document of snapshot.docs) {
    const data = document.data();

    if (typeof data.position !== "number" || !Number.isInteger(data.position)) {
      continue;
    }

    players.set(document.id, {
      position: data.position,
      gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
    });
  }

  return players;
}

function allEngineTies(tiesSnapshot: QuerySnapshot): StoredKnockoutTie[] {
  return tiesSnapshot.docs.map((document) => readEngineTie(document.data()));
}

function tiesForRound(
  ties: readonly StoredKnockoutTie[],
  round: KnockoutRound,
): StoredKnockoutTie[] {
  return ties.filter((tie) => tie.round === round).sort((a, b) => a.bracketSlot - b.bracketSlot);
}

function requireRoundPrerequisites(round: KnockoutRound, ties: readonly StoredKnockoutTie[]): void {
  const existing = tiesForRound(ties, round);

  if (existing.length > 0) {
    throw new TournamentMutationError(
      `The ${KNOCKOUT_ROUND_LABELS[round].toLowerCase()} has already been published.`,
      409,
    );
  }

  const previous = previousKnockoutRound(round);

  if (!previous) {
    return;
  }

  const previousTies = tiesForRound(ties, previous);
  const expectedCount = KNOCKOUT_ROUND_TIE_COUNTS[previous];

  if (previousTies.length !== expectedCount) {
    throw new TournamentMutationError(
      `Publish the ${KNOCKOUT_ROUND_LABELS[previous].toLowerCase()} before drawing the ${KNOCKOUT_ROUND_LABELS[round].toLowerCase()}.`,
      409,
    );
  }

  if (previousTies.some((tie) => tie.status !== "completed" || !tie.winnerUid)) {
    throw new TournamentMutationError(
      `Every ${KNOCKOUT_ROUND_LABELS[previous].toLowerCase()} tie must be decided first.`,
      409,
    );
  }
}

function tagFor(players: Map<string, { readonly gamerTag: string }>, uid: string): string {
  return players.get(uid)?.gamerTag ?? (uid.slice(0, 12) || "Player");
}

function buildScheduledTies(input: {
  readonly round: KnockoutRound;
  readonly legs: KnockoutLegs;
  readonly standings: Map<string, { readonly position: number; readonly gamerTag: string }>;
  readonly ties: readonly StoredKnockoutTie[];
  readonly seed: string;
}): KnockoutTie[] {
  const { round, legs, standings, ties, seed } = input;

  if (round === "playoff") {
    const players: KnockoutPlayer[] = [...standings.entries()].map(([uid, player]) => ({
      playerId: uid,
      position: player.position,
      gamerTag: player.gamerTag,
    }));

    if (players.length !== PLAYER_COUNT) {
      throw new TournamentMutationError(
        `The knockout needs all ${PLAYER_COUNT} league positions.`,
        409,
      );
    }

    return [...buildPlayoffTies({ standings: players, seed, legs })];
  }

  if (round === "r16") {
    const directQualifiers: KnockoutPlayer[] = [];
    const directPlayers = [...standings.entries()].filter(
      ([, player]) => player.position >= 1 && player.position <= 8,
    );

    if (directPlayers.length !== 8) {
      throw new TournamentMutationError("The league table has no complete top eight.", 409);
    }

    for (const [uid, player] of directPlayers) {
      directQualifiers.push({
        playerId: uid,
        position: player.position,
        gamerTag: player.gamerTag,
      });
    }

    const playoffTies = tiesForRound(ties, "playoff");
    const playoffWinners: PlayoffWinner[] = playoffTies.map((tie) => ({
      playerId: tie.winnerUid as string,
      position: tie.winnerPosition as number,
      group: tie.group as PlayoffWinner["group"],
      tieId: tie.tieId,
      gamerTag: tagFor(standings, tie.winnerUid as string),
    }));

    return [...buildRoundOf16Ties({ directQualifiers, playoffWinners, seed, legs })];
  }

  const previous = previousKnockoutRound(round);

  if (!previous) {
    throw new TournamentMutationError("There is no round before the play-offs.", 409);
  }

  const previousTies = tiesForRound(ties, previous);

  return [...buildNextRound(previousTies, legs)];
}

function draftTieFromEngine(
  tie: KnockoutTie,
  standings: Map<string, { readonly gamerTag: string }>,
): KnockoutDraftTie {
  return {
    tieId: tie.tieId,
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    higherSeedUid: tie.higherSeedUid,
    higherSeedTag: tagFor(standings, tie.higherSeedUid),
    higherSeedPosition: tie.higherSeedPosition,
    lowerSeedUid: tie.lowerSeedUid,
    lowerSeedTag: tagFor(standings, tie.lowerSeedUid),
    lowerSeedPosition: tie.lowerSeedPosition,
    group: tie.group,
    sourceTieIds: tie.sourceTieIds,
  };
}

function draftTieToEngine(tie: KnockoutDraftTie, round: KnockoutRound): KnockoutTie {
  return {
    tieId: tie.tieId,
    round,
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    higherSeedUid: tie.higherSeedUid,
    lowerSeedUid: tie.lowerSeedUid,
    higherSeedPosition: tie.higherSeedPosition,
    lowerSeedPosition: tie.lowerSeedPosition,
    group: tie.group,
    sourceTieIds: tie.sourceTieIds,
    winnerUid: null,
    winnerPosition: null,
  };
}

/** Server-side draft shape; `generatedAt` is an Admin SDK Timestamp. */
export interface StoredKnockoutDraft {
  readonly round: KnockoutRound;
  readonly seed: string;
  readonly legs: KnockoutLegs;
  readonly ties: readonly KnockoutDraftTie[];
  readonly generatedBy: string;
  readonly generatedAt: Timestamp;
  readonly generationCount: number;
  readonly validation: {
    readonly valid: boolean;
    readonly issues: readonly { readonly code: string; readonly message: string }[];
  };
}

function readDraft(
  data: Record<string, unknown> | undefined,
  round: KnockoutRound,
): StoredKnockoutDraft | null {
  if (!data || !Array.isArray(data.ties) || data.round !== round) {
    return null;
  }

  const ties: KnockoutDraftTie[] = [];

  for (const entry of data.ties) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const tie = entry as Record<string, unknown>;

    if (
      typeof tie.tieId !== "string" ||
      typeof tie.bracketSlot !== "number" ||
      typeof tie.higherSeedUid !== "string" ||
      typeof tie.lowerSeedUid !== "string" ||
      typeof tie.higherSeedPosition !== "number" ||
      typeof tie.lowerSeedPosition !== "number"
    ) {
      continue;
    }

    ties.push({
      tieId: tie.tieId,
      bracketSlot: tie.bracketSlot,
      legs: tie.legs === 1 ? 1 : 2,
      higherSeedUid: tie.higherSeedUid,
      higherSeedTag: readText(tie.higherSeedTag, "Player"),
      higherSeedPosition: tie.higherSeedPosition,
      lowerSeedUid: tie.lowerSeedUid,
      lowerSeedTag: readText(tie.lowerSeedTag, "Player"),
      lowerSeedPosition: tie.lowerSeedPosition,
      group:
        tie.group === "A" || tie.group === "B" || tie.group === "C" || tie.group === "D"
          ? tie.group
          : null,
      sourceTieIds: Array.isArray(tie.sourceTieIds)
        ? tie.sourceTieIds.filter((id): id is string => typeof id === "string")
        : [],
    });
  }

  return {
    round,
    seed: readText(data.seed, ""),
    legs: data.legs === 1 ? 1 : 2,
    ties,
    generatedBy: readText(data.generatedBy, ""),
    generatedAt: (data.generatedAt as Timestamp | undefined) ?? Timestamp.now(),
    generationCount: typeof data.generationCount === "number" ? data.generationCount : 1,
    validation: {
      valid:
        typeof data.validation === "object" &&
        data.validation !== null &&
        (data.validation as { valid?: unknown }).valid === true,
      issues: [],
    },
  };
}

function roundLegs(
  round: KnockoutRound,
  config: KnockoutConfig,
  requested: KnockoutLegs | undefined,
): KnockoutLegs {
  if (round === "final") {
    if (requested !== undefined && requested !== 1) {
      throw new TournamentMutationError("The final is always one match.", 409);
    }

    return 1;
  }

  return requested ?? config[round];
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
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly higherSeedUid: string;
  readonly higherSeedTag: string;
  readonly higherSeedPosition: number;
  readonly lowerSeedUid: string;
  readonly lowerSeedTag: string;
  readonly lowerSeedPosition: number;
  readonly group: string | null;
  readonly status: KnockoutTieDocument["status"];
  readonly aggregate: KnockoutTieDocument["aggregate"];
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly decidedBy: KnockoutTieDocument["decidedBy"];
  readonly deciderNote: string | null;
  readonly penalties: KnockoutTieDocument["penalties"];
  readonly matches: readonly OrganiserKnockoutMatchView[];
}

export interface OrganiserKnockoutRoundView {
  readonly round: KnockoutRound;
  readonly label: string;
  readonly legs: KnockoutLegs;
  readonly draft: StoredKnockoutDraft | null;
  readonly published: boolean;
  readonly complete: boolean;
  readonly ties: readonly OrganiserKnockoutTieView[];
}

export interface OrganiserKnockoutView {
  readonly tournament: TournamentDocument;
  readonly rounds: readonly OrganiserKnockoutRoundView[];
  readonly leagueMatchesCompleted: number;
  readonly leagueMatchesTotal: number;
  readonly leagueClosed: boolean;
  readonly championTag: string | null;
  readonly runnerUpTag: string | null;
}

/** Guarded read for the organiser knockout workspace. */
export async function getOrganiserKnockout(tournamentId: string): Promise<OrganiserKnockoutView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const [tiesSnapshot, matchesSnapshot, draftsSnapshot, standingsSnapshot] = await Promise.all([
    firestore.collection(paths.tournamentKnockoutTies(tournamentId)).get(),
    firestore.collection(paths.tournamentMatches(tournamentId)).get(),
    firestore.collection(paths.tournamentKnockoutDrafts(tournamentId)).get(),
    firestore.collection(paths.tournamentStandings(tournamentId)).get(),
  ]);

  const standings = readStandingsPlayers(standingsSnapshot);
  const config = normaliseConfig(access.tournament.knockoutConfig);
  const drafts = new Map<string, StoredKnockoutDraft>();

  for (const document of draftsSnapshot.docs) {
    if (!isKnockoutRound(document.id)) {
      continue;
    }

    const draft = readDraft(document.data(), document.id);

    if (draft) {
      drafts.set(document.id, draft);
    }
  }

  const matchesByTie = new Map<string, OrganiserKnockoutMatchView[]>();

  for (const document of matchesSnapshot.docs) {
    const data = document.data();

    if (typeof data.tieId !== "string" || typeof data.leg !== "number") {
      continue;
    }

    const list = matchesByTie.get(data.tieId) ?? [];
    const result = readStoredResult(data.result);

    list.push({
      id: document.id,
      leg: data.leg,
      homeUid: readText(data.homeUid, ""),
      awayUid: readText(data.awayUid, ""),
      homeTag: readText(data.homeTag, "Player"),
      awayTag: readText(data.awayTag, "Player"),
      homeGoals: result?.homeGoals ?? null,
      awayGoals: result?.awayGoals ?? null,
      status: data.status === "completed" ? "completed" : "scheduled",
    });
    matchesByTie.set(data.tieId, list);
  }

  const tiesByRound = new Map<KnockoutRound, OrganiserKnockoutTieView[]>();

  for (const document of tiesSnapshot.docs) {
    const data = document.data();

    if (!isKnockoutRound(data.round)) {
      continue;
    }

    const tie = readEngineTie(data);
    const list = tiesByRound.get(tie.round) ?? [];

    list.push({
      tieId: tie.tieId,
      round: tie.round,
      bracketSlot: tie.bracketSlot,
      legs: tie.legs,
      higherSeedUid: tie.higherSeedUid,
      higherSeedTag: readText(data.higherSeedTag, tagFor(standings, tie.higherSeedUid)),
      higherSeedPosition: tie.higherSeedPosition,
      lowerSeedUid: tie.lowerSeedUid,
      lowerSeedTag: readText(data.lowerSeedTag, tagFor(standings, tie.lowerSeedUid)),
      lowerSeedPosition: tie.lowerSeedPosition,
      group: tie.group,
      status:
        data.status === "in_progress" ||
        data.status === "needs_decider" ||
        data.status === "completed"
          ? data.status
          : "pending",
      aggregate:
        typeof data.aggregate === "object" && data.aggregate !== null
          ? {
              higherGoals:
                typeof (data.aggregate as { higherGoals?: unknown }).higherGoals === "number"
                  ? ((data.aggregate as { higherGoals: number }).higherGoals ?? 0)
                  : 0,
              lowerGoals:
                typeof (data.aggregate as { lowerGoals?: unknown }).lowerGoals === "number"
                  ? ((data.aggregate as { lowerGoals: number }).lowerGoals ?? 0)
                  : 0,
            }
          : { higherGoals: 0, lowerGoals: 0 },
      legsPlayed: typeof data.legsPlayed === "number" ? data.legsPlayed : 0,
      winnerUid: tie.winnerUid ?? null,
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
              higher:
                typeof (data.penalties as { higher?: unknown }).higher === "number"
                  ? ((data.penalties as { higher: number }).higher ?? 0)
                  : 0,
              lower:
                typeof (data.penalties as { lower?: unknown }).lower === "number"
                  ? ((data.penalties as { lower: number }).lower ?? 0)
                  : 0,
            }
          : null,
      matches: (matchesByTie.get(tie.tieId) ?? []).sort((a, b) => a.leg - b.leg),
    });
    tiesByRound.set(tie.round, list);
  }

  const rounds = KNOCKOUT_ROUND_ORDER.map((round): OrganiserKnockoutRoundView => {
    const ties = (tiesByRound.get(round) ?? []).sort((a, b) => a.bracketSlot - b.bracketSlot);

    return {
      round,
      label: KNOCKOUT_ROUND_LABELS[round],
      legs: round === "final" ? 1 : config[round],
      draft: drafts.get(round) ?? null,
      published: ties.length > 0,
      complete:
        ties.length > 0 &&
        ties.every((tie) => tie.status === "completed" && tie.winnerUid !== null),
      ties,
    };
  });

  // Count the real completed league match documents rather than trusting a
  // cached counter; the close action checks the same documents, so the button
  // and the server boundary always agree.
  const leagueMatchesCompleted = matchesSnapshot.docs.filter((document) => {
    const data = document.data();
    return data.stage === "league" && data.status === "completed";
  }).length;

  return {
    tournament: access.tournament,
    rounds,
    leagueMatchesCompleted,
    leagueMatchesTotal: LEAGUE_MATCH_TOTAL,
    leagueClosed: Boolean(access.tournament.leaguePhaseClosedAt),
    championTag:
      access.tournament.championUid && standings.has(access.tournament.championUid)
        ? (standings.get(access.tournament.championUid)?.gamerTag ?? null)
        : null,
    runnerUpTag:
      access.tournament.runnerUpUid && standings.has(access.tournament.runnerUpUid)
        ? (standings.get(access.tournament.runnerUpUid)?.gamerTag ?? null)
        : null,
  };
}

/** Closes the league phase once all 144 results exist. Standings stay frozen. */
export async function closeLeaguePhase(
  tournamentId: string,
): Promise<{ readonly closedAt: Timestamp }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const matchesRef = firestore.collection(paths.tournamentMatches(tournamentId));
  const standingsRef = firestore.collection(paths.tournamentStandings(tournamentId));

  const closed = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "league_phase") {
      throw new TournamentMutationError(
        "The league phase can only be closed while it is running.",
        409,
      );
    }

    const matchesSnapshot = await transaction.get(matchesRef);
    const standingsSnapshot = await transaction.get(standingsRef);
    const leagueMatches = matchesSnapshot.docs.filter(
      (document) => document.data().stage === "league",
    );

    if (leagueMatches.length !== LEAGUE_MATCH_TOTAL) {
      throw new TournamentMutationError(
        `Close the league phase only after all ${LEAGUE_MATCH_TOTAL} matches exist; found ${leagueMatches.length}.`,
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

    const now = Timestamp.now();
    // Freeze the table: the league is complete, so every row stops being
    // provisional. Knockout results never touch these documents again.
    for (const document of standingsSnapshot.docs) {
      transaction.update(document.ref, { provisional: false, updatedAt: now });
    }

    transaction.update(tournamentRef, {
      status: "knockout",
      leaguePhaseClosedAt: now,
      knockoutConfig: normaliseConfig(tournament.knockoutConfig),
      knockoutRounds: [],
      championUid: null,
      runnerUpUid: null,
      completedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      closedAt: now,
      bands: standingsSnapshot.docs.map((document) => ({
        uid: document.id,
        position:
          typeof document.data().position === "number" ? (document.data().position as number) : 0,
      })),
    };
  });
  const { closedAt } = closed;

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.league_phase.closed",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: "league_phase" },
    after: {
      status: "knockout",
      leagueMatchesCompleted: LEAGUE_MATCH_TOTAL,
      leaguePhaseClosedAt: closedAt.toDate().toISOString(),
    },
  });

  const direct = closed.bands
    .filter((band) => band.position >= 1 && band.position <= 8)
    .map((band) => band.uid);
  const playoff = closed.bands
    .filter((band) => band.position >= 9 && band.position <= 24)
    .map((band) => band.uid);
  const eliminated = closed.bands.filter((band) => band.position >= 25).map((band) => band.uid);
  const link = `/tournaments/${access.tournament.slug}`;

  await Promise.all(
    [
      createNotifications(direct, {
        type: "tournament",
        title: "You qualified directly for the Round of 16",
        body: "The league phase is closed. The top eight go straight into the knockout Round of 16.",
        link,
      }),
      createNotifications(playoff, {
        type: "tournament",
        title: "You are in the knockout play-offs",
        body: "The league phase is closed. Positions 9-24 meet in the play-offs for a place in the Round of 16.",
        link,
      }),
      createNotifications(eliminated, {
        type: "tournament",
        title: "Your league phase has ended",
        body: "The league phase is closed. The final table is frozen and the knockout bracket is being prepared.",
        link,
      }),
    ].map((notification) => notification.catch(() => undefined)),
  );

  return { closedAt };
}

export interface DrawKnockoutRoundResult {
  readonly round: KnockoutRound;
  readonly legs: KnockoutLegs;
  readonly tieCount: number;
  readonly generationCount: number;
  readonly seed: string;
}

/** Builds and stores a private draft for one knockout round. */
export async function drawKnockoutRound(
  tournamentId: string,
  round: KnockoutRound,
  requestedLegs?: KnockoutLegs,
): Promise<DrawKnockoutRoundResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));
  const standingsRef = firestore.collection(paths.tournamentStandings(tournamentId));
  const draftRef = firestore.doc(paths.tournamentKnockoutDraft(tournamentId, round));
  const seed = newSeed();

  const result = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "knockout" || !tournament.leaguePhaseClosedAt) {
      throw new TournamentMutationError("Close the league phase before drawing the knockout.", 409);
    }

    const [tiesSnapshot, standingsSnapshot, draftSnapshot] = await Promise.all([
      transaction.get(tiesRef),
      transaction.get(standingsRef),
      transaction.get(draftRef),
    ]);
    const ties = allEngineTies(tiesSnapshot);
    requireRoundPrerequisites(round, ties);

    const standings = readStandingsPlayers(standingsSnapshot);
    const config = normaliseConfig(tournament.knockoutConfig);
    const legs = roundLegs(round, config, requestedLegs);
    let built: KnockoutTie[];

    try {
      built = buildScheduledTies({ round, legs, standings, ties, seed });
    } catch (error) {
      throw new TournamentMutationError(
        error instanceof Error ? error.message : "The knockout draw failed.",
        409,
      );
    }

    const validation = validateKnockoutRound({ round, ties: built });

    if (validation.valid === false) {
      throw new TournamentMutationError(
        `The draw did not pass validation: ${validation.issues.map((issue) => issue.message).join(" ")}`,
        500,
      );
    }

    const previous = readDraft(draftSnapshot.data(), round);
    const now = Timestamp.now();
    const generationCount = (previous?.generationCount ?? 0) + 1;
    const draft: StoredKnockoutDraft = {
      round,
      seed,
      legs,
      ties: built.map((tie) => draftTieFromEngine(tie, standings)),
      generatedBy: access.user.userId,
      generatedAt: now,
      generationCount,
      validation: { valid: true, issues: [] },
    };

    transaction.set(draftRef, draft);
    transaction.update(tournamentRef, {
      [`knockoutConfig.${round}`]: legs,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { legs, tieCount: built.length, generationCount };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.knockout.drawn",
    targetType: "knockoutDraft",
    targetId: `${tournamentId}/${round}`,
    tournamentId,
    before: null,
    after: {
      round,
      seed,
      legs: result.legs,
      tieCount: result.tieCount,
      generationCount: result.generationCount,
    },
  });

  return { round, ...result, seed };
}

function tieDocument(
  tie: KnockoutTie,
  tags: { readonly higher: string; readonly lower: string },
  now: Timestamp,
): Record<string, unknown> {
  return {
    tieId: tie.tieId,
    round: tie.round,
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    higherSeedUid: tie.higherSeedUid,
    higherSeedTag: tags.higher,
    higherSeedPosition: tie.higherSeedPosition,
    lowerSeedUid: tie.lowerSeedUid,
    lowerSeedTag: tags.lower,
    lowerSeedPosition: tie.lowerSeedPosition,
    group: tie.group,
    sourceTieIds: tie.sourceTieIds,
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

function homeUid(tie: KnockoutTie, leg: number): string {
  // Inlined here to avoid importing a helper twice; the rule is fixed.
  if (tie.legs === 1) {
    return tie.higherSeedUid;
  }

  return leg === 1 ? tie.lowerSeedUid : tie.higherSeedUid;
}

function awayUid(tie: KnockoutTie, leg: number): string {
  return homeUid(tie, leg) === tie.higherSeedUid ? tie.lowerSeedUid : tie.higherSeedUid;
}

export interface PublishKnockoutRoundResult {
  readonly round: KnockoutRound;
  readonly tieCount: number;
  readonly matchCount: number;
}

/** Publishes a validated draft as public ties and leg matches. */
export async function publishKnockoutRound(
  tournamentId: string,
  round: KnockoutRound,
): Promise<PublishKnockoutRoundResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));
  const draftRef = firestore.doc(paths.tournamentKnockoutDraft(tournamentId, round));

  const result = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "knockout") {
      throw new TournamentMutationError("The knockout is not running.", 409);
    }

    const [tiesSnapshot, draftSnapshot] = await Promise.all([
      transaction.get(tiesRef),
      transaction.get(draftRef),
    ]);
    const ties = allEngineTies(tiesSnapshot);
    requireRoundPrerequisites(round, ties);

    const draft = readDraft(draftSnapshot.data(), round);

    if (!draft || draft.ties.length !== KNOCKOUT_ROUND_TIE_COUNTS[round]) {
      throw new TournamentMutationError(
        `Draw the ${KNOCKOUT_ROUND_LABELS[round].toLowerCase()} before publishing it.`,
        409,
      );
    }

    const engineTies = draft.ties.map((tie) => draftTieToEngine(tie, round));
    const validation = validateKnockoutRound({ round, ties: engineTies });
    const previous = previousKnockoutRound(round);
    // The Round of 16 comes from the seeded play-off groups, not from adjacent
    // play-off slots, so its own validator owns the path. Every later round is
    // a direct adjacent-slot progression.
    const progression =
      previous === null || previous === "playoff"
        ? { valid: true, issues: [] }
        : validateProgression(tiesForRound(ties, previous), engineTies);

    if (!validation.valid || !progression.valid) {
      throw new TournamentMutationError(
        `The stored draft is invalid: ${[...validation.issues, ...progression.issues]
          .map((issue) => issue.message)
          .join(" ")}`,
        409,
      );
    }

    const now = Timestamp.now();
    const tags = new Map<string, string>();

    for (const tie of draft.ties) {
      tags.set(tie.higherSeedUid, tie.higherSeedTag);
      tags.set(tie.lowerSeedUid, tie.lowerSeedTag);
    }

    let matchCount = 0;

    for (const tie of engineTies) {
      const document = tieDocument(
        tie,
        {
          higher: tags.get(tie.higherSeedUid) ?? (tie.higherSeedUid.slice(0, 12) || "Player"),
          lower: tags.get(tie.lowerSeedUid) ?? (tie.lowerSeedUid.slice(0, 12) || "Player"),
        },
        now,
      );

      transaction.set(
        firestore.doc(paths.tournamentKnockoutTie(tournamentId, tie.tieId)),
        document,
      );

      for (let leg = 1; leg <= tie.legs; leg += 1) {
        const home = homeUid(tie, leg);
        const away = awayUid(tie, leg);
        const matchId = `${tie.tieId}-l${leg}`;

        transaction.set(firestore.doc(paths.tournamentMatch(tournamentId, matchId)), {
          tournamentId,
          stage: round,
          matchday: 0,
          homeUid: home,
          awayUid: away,
          homeTag: tags.get(home) ?? (home.slice(0, 12) || "Player"),
          awayTag: tags.get(away) ?? (away.slice(0, 12) || "Player"),
          participants: [home, away],
          status: "scheduled",
          scheduledAt: null,
          result: null,
          tieId: tie.tieId,
          leg,
          updatedAt: now,
        });
        matchCount += 1;
      }
    }

    const rounds = Array.isArray(tournament.knockoutRounds)
      ? tournament.knockoutRounds.filter(isKnockoutRound)
      : [];
    const nextRounds = [...rounds.filter((value) => value !== round), round].sort(
      (a, b) => roundIndex(a) - roundIndex(b),
    );

    transaction.delete(draftRef);
    transaction.update(tournamentRef, {
      knockoutRounds: nextRounds,
      [`knockoutConfig.${round}`]: draft.legs,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tieCount: engineTies.length, matchCount, playerIds: [...tags.keys()] };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.knockout.published",
    targetType: "knockoutRound",
    targetId: `${tournamentId}/${round}`,
    tournamentId,
    before: null,
    after: {
      round,
      tieCount: result.tieCount,
      matchCount: result.matchCount,
    },
  });

  for (let index = 0; index < result.playerIds.length; index += 18) {
    await createNotifications(result.playerIds.slice(index, index + 18), {
      type: "fixture",
      title: `${KNOCKOUT_ROUND_LABELS[round]} drawn`,
      body: "Your knockout tie is published. Check the bracket and the match list.",
      link: `/tournaments/${access.tournament.slug}`,
    }).catch(() => undefined);
  }

  return { round, tieCount: result.tieCount, matchCount: result.matchCount };
}

/** Deletes an unpublished draft. Published rounds are immutable. */
export async function resetKnockoutRound(
  tournamentId: string,
  round: KnockoutRound,
  reason: string | undefined,
): Promise<{ readonly deleted: boolean }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));
  const draftRef = firestore.doc(paths.tournamentKnockoutDraft(tournamentId, round));

  const deleted = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const [tiesSnapshot, draftSnapshot] = await Promise.all([
      transaction.get(tiesRef),
      transaction.get(draftRef),
    ]);
    const published = tiesSnapshot.docs.some((document) => document.data().round === round);

    if (published) {
      throw new TournamentMutationError(
        "A published round is immutable. Knockout rounds can only be reset before publication.",
        409,
      );
    }

    if (!draftSnapshot.exists) {
      return false;
    }

    transaction.delete(draftRef);
    return true;
  });

  if (deleted) {
    await writeAuditLog({
      actorUid: access.user.userId,
      actorRole: access.user.role,
      action: "tournament.knockout.draft_reset",
      targetType: "knockoutDraft",
      targetId: `${tournamentId}/${round}`,
      tournamentId,
      before: { round },
      after: { deleted: true },
      reason: reason ?? null,
    });
  }

  return { deleted };
}

/** Applies the organiser's extra-time or penalty decider to a level tie. */
export async function decideKnockoutTie(
  tournamentId: string,
  tieId: string,
  input: KnockoutDecideInput,
): Promise<{ readonly winnerUid: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tieRef = firestore.doc(paths.tournamentKnockoutTie(tournamentId, tieId));
  const matchesRef = firestore
    .collection(paths.tournamentMatches(tournamentId))
    .where("tieId", "==", tieId);

  const decidedResult = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    if ((tournamentSnapshot.data() as TournamentDocument).status !== "knockout") {
      throw new TournamentMutationError("The knockout is not running.", 409);
    }

    const [tieSnapshot, matchesSnapshot] = await Promise.all([
      transaction.get(tieRef),
      transaction.get(matchesRef),
    ]);

    if (!tieSnapshot.exists) {
      throw new TournamentMutationError("Knockout tie not found.", 404);
    }

    const data = tieSnapshot.data() as Record<string, unknown>;
    const tie = readEngineTie(data);
    const matches = matchesSnapshot.docs.map((document) => readEngineMatch(document.data(), 0));
    const resolution = resolveTie(tie, matches);

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
    let decided: TieResolution;

    try {
      decided = applyDecider(resolution, tie, decider);
    } catch (error) {
      throw new TournamentMutationError(
        error instanceof Error ? error.message : "The decider is invalid.",
        400,
      );
    }

    if (!decided.winnerUid) {
      throw new TournamentMutationError("The decider did not produce a winner.", 500);
    }

    const now = Timestamp.now();
    const position =
      decided.winnerUid === tie.higherSeedUid ? tie.higherSeedPosition : tie.lowerSeedPosition;

    transaction.update(tieRef, {
      status: "completed",
      aggregate: decided.aggregate,
      legsPlayed: decided.legsPlayed,
      winnerUid: decided.winnerUid,
      winnerPosition: position,
      decidedBy: decided.decidedBy,
      deciderNote: decider.note,
      penalties: decider.penalties,
      updatedAt: now,
    });

    return { winnerUid: decided.winnerUid, tie, round: tie.round };
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
      round: decidedResult.round,
      winnerUid: decidedResult.winnerUid,
      method: input.method,
      penalties: input.penalties ?? null,
      note: input.note ?? null,
    },
    reason: input.note ?? null,
  });

  return { winnerUid: decidedResult.winnerUid };
}

/** Completes the tournament once the final has a winner. Standings stay frozen. */
export async function completeTournament(
  tournamentId: string,
  reason: string | undefined,
): Promise<{ readonly championUid: string; readonly runnerUpUid: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const tiesRef = firestore.collection(paths.tournamentKnockoutTies(tournamentId));
  const registrationsRef = firestore.collection(paths.tournamentRegistrations(tournamentId));

  const summary = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "knockout") {
      throw new TournamentMutationError(
        "Complete the tournament only while the knockout is running.",
        409,
      );
    }

    const [tiesSnapshot, registrationsSnapshot] = await Promise.all([
      transaction.get(tiesRef),
      transaction.get(registrationsRef),
    ]);
    const finalDocs = tiesSnapshot.docs.filter((document) => document.data().round === "final");

    if (finalDocs.length !== 1) {
      throw new TournamentMutationError("Publish and decide the final first.", 409);
    }

    const finalData = finalDocs[0]?.data() ?? {};
    const finalTie = readEngineTie(finalData);
    const finalStatus = finalData.status;

    if (finalStatus !== "completed" || !finalTie.winnerUid) {
      throw new TournamentMutationError("The final has no winner yet.", 409);
    }

    const championUid = finalTie.winnerUid;
    const runnerUpUid =
      championUid === finalTie.higherSeedUid ? finalTie.lowerSeedUid : finalTie.higherSeedUid;
    const now = Timestamp.now();
    const registeredUids = registrationsSnapshot.docs
      .filter((document) => document.data().status === "registered")
      .map((document) => document.id);
    const membershipDocs = await Promise.all(
      registeredUids.map((uid) =>
        transaction.get(firestore.doc(paths.userMembership(uid, tournamentId))),
      ),
    );

    membershipDocs.forEach((snapshot, index) => {
      const uid = registeredUids[index];

      if (!uid || !snapshot.exists) {
        return;
      }

      const data = snapshot.data() ?? {};

      transaction.update(snapshot.ref, {
        status: "completed",
        playerStatus: data.playerStatus ?? data.status ?? "registered",
        updatedAt: now,
      });
    });

    transaction.update(tournamentRef, {
      status: "completed",
      championUid,
      runnerUpUid,
      completedAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      championUid,
      runnerUpUid,
      playerIds: registeredUids,
      slug: tournament.slug,
      name: tournament.name,
    };
  });

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
    reason: reason ?? null,
  });

  for (let index = 0; index < summary.playerIds.length; index += 18) {
    await createNotifications(summary.playerIds.slice(index, index + 18), {
      type: "tournament",
      title: `${summary.name} is complete`,
      body: "The final result is in. The champion and the frozen league table are on the tournament page.",
      link: `/tournaments/${summary.slug}`,
    }).catch(() => undefined);
  }

  return { championUid: summary.championUid, runnerUpUid: summary.runnerUpUid };
}

// Re-exported for the knockout result module so both paths share one rule.
export { nextRoundFor, winnerPosition };
