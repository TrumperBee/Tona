// GCC - server-side league standings.
//
// Standings are derived data. There is no manual table row and no client write:
// every value comes from the 36 entered players and the recorded league results.
// The pure engine in `src/lib/engine/standings` does the ordering; this module
// supplies identities, the deterministic lot seed and the Firestore documents.
//
// Result transactions read the tournament, the draw, the registrations and all
// matches BEFORE writing anything (Firestore requires reads first), apply any
// pending result change in memory, then write all 36 standings and the
// tournament counters in the SAME transaction. A failed transaction leaves the
// previous table exactly as it was.
import "server-only";

import {
  FieldValue,
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Transaction,
} from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import {
  computeStandings,
  DEFAULT_TIEBREAKER_PROFILE,
  deriveLot,
  TIEBREAKER_PROFILES,
  type StandingRow,
  type StandingsMatch,
  type StandingsPlayer,
  type TiebreakerProfile,
} from "@/lib/engine/standings";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { TournamentMutationError } from "@/lib/tournament/errors";
import type { DrawPlayerSnapshot, StandingDocument, TournamentDocument } from "@/types/domain";

/** The full round-robin field size. */
export const LEAGUE_PLAYER_COUNT = 36;

/** Every league match in the row-robin: 36 players x 8 matches / 2. */
export const LEAGUE_MATCH_TOTAL = 144;

const POT_KEYS = ["1", "2", "3", "4"] as const;

export interface StandingsPlayerIdentity {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
}

export interface StandingsMatchRecord {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly result: { readonly homeGoals: number; readonly awayGoals: number } | null;
}

export interface StandingsSource {
  readonly tournamentId: string;
  readonly profile: TiebreakerProfile;
  readonly tiebreakSeed: string;
  readonly players: readonly StandingsPlayerIdentity[];
  readonly matches: readonly StandingsMatchRecord[];
}

/** Pending result changes applied in memory before the table is computed. */
export type PendingResults = ReadonlyMap<
  string,
  { readonly homeGoals: number; readonly awayGoals: number } | null
>;

export interface StandingWrite extends Omit<StandingDocument, "updatedAt"> {
  readonly updatedAt: Timestamp;
}

export interface StandingsPlan {
  readonly rows: readonly StandingRow[];
  readonly players: readonly StandingsPlayerIdentity[];
  readonly documents: readonly { readonly uid: string; readonly data: StandingWrite }[];
  readonly leagueMatchesCompleted: number;
  readonly provisional: boolean;
  readonly profile: TiebreakerProfile;
  readonly updatedAt: Timestamp;
}

export interface StandingsViewRow extends StandingWrite {
  readonly uid: string;
}

export interface StandingsView {
  readonly tournament: TournamentDocument;
  readonly rows: readonly StandingsViewRow[];
  readonly profile: TiebreakerProfile;
  readonly provisional: boolean;
  readonly updatedAt: string | null;
}

export interface StandingsVerifyIssue {
  readonly uid: string;
  readonly fields: readonly string[];
}

export interface StandingsVerifyResult {
  readonly valid: boolean;
  readonly checked: number;
  readonly completedMatches: number;
  readonly profile: TiebreakerProfile;
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
  readonly mismatches: readonly StandingsVerifyIssue[];
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readSnapshotMap(value: unknown): Record<string, DrawPlayerSnapshot> {
  const result: Record<string, DrawPlayerSnapshot> = {};

  if (typeof value !== "object" || value === null) {
    return result;
  }

  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const data = entry as Record<string, unknown>;

    if (typeof data.gamerTag !== "string") {
      continue;
    }

    result[uid] = {
      gamerTag: data.gamerTag,
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: typeof data.country === "string" ? data.country : "",
    };
  }

  return result;
}

function readPotIds(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const key of POT_KEYS) {
    const entry = record[key];

    if (!Array.isArray(entry)) {
      continue;
    }

    for (const uid of entry) {
      if (typeof uid === "string" && uid.length > 0 && !seen.has(uid)) {
        seen.add(uid);
        ids.push(uid);
      }
    }
  }

  return ids;
}

/**
 * Player identities from a draw snapshot, in pot order. Used both by the
 * normal rebuild and by publication, where the draw is the only source of the
 * confirmed field.
 */
export function drawStandingsPlayers(
  drawData: Record<string, unknown> | undefined,
): StandingsPlayerIdentity[] {
  if (!drawData) {
    return [];
  }

  const snapshots = readSnapshotMap(drawData.playersSnapshot);

  return readPotIds(drawData.pots).map((uid) => ({
    uid,
    gamerTag: snapshots[uid]?.gamerTag ?? (uid.slice(0, 12) || "Player"),
    avatarUrl: snapshots[uid]?.avatarUrl ?? null,
  }));
}

function drawTiebreakSeed(drawData: Record<string, unknown> | undefined): string | null {
  return typeof drawData?.tiebreakSeed === "string" && drawData.tiebreakSeed.length > 0
    ? drawData.tiebreakSeed
    : null;
}

function fallbackTiebreakSeed(tournamentId: string): string {
  return `standings:${tournamentId}`;
}

function readRegistrationPlayers(snapshot: QuerySnapshot): StandingsPlayerIdentity[] {
  return snapshot.docs
    .filter((document) => document.data().status === "registered")
    .map((document) => {
      const data = document.data();

      return {
        uid: document.id,
        gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      };
    })
    .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

function readMatches(snapshot: QuerySnapshot): StandingsMatchRecord[] {
  return snapshot.docs
    .map((document): StandingsMatchRecord | null => {
      const data = document.data();

      if (data.stage !== "league") {
        return null;
      }

      const homeUid = readText(data.homeUid, "");
      const awayUid = readText(data.awayUid, "");

      if (homeUid.length === 0 || awayUid.length === 0) {
        return null;
      }

      const result =
        typeof data.result === "object" && data.result !== null
          ? (data.result as Record<string, unknown>)
          : null;
      const homeGoals = readNumber(result?.homeGoals);
      const awayGoals = readNumber(result?.awayGoals);

      return {
        id: document.id,
        matchday: typeof data.matchday === "number" ? data.matchday : 0,
        homeUid,
        awayUid,
        result: homeGoals !== null && awayGoals !== null ? { homeGoals, awayGoals } : null,
      };
    })
    .filter((entry): entry is StandingsMatchRecord => entry !== null);
}

function matchParticipantPlayers(snapshot: QuerySnapshot): StandingsPlayerIdentity[] {
  const players = new Map<string, StandingsPlayerIdentity>();

  for (const document of snapshot.docs) {
    const data = document.data();

    if (data.stage !== "league") {
      continue;
    }

    const homeUid = readText(data.homeUid, "");
    const awayUid = readText(data.awayUid, "");

    if (homeUid.length > 0 && !players.has(homeUid)) {
      players.set(homeUid, {
        uid: homeUid,
        gamerTag: readText(data.homeTag, homeUid.slice(0, 12) || "Player"),
        avatarUrl: null,
      });
    }

    if (awayUid.length > 0 && !players.has(awayUid)) {
      players.set(awayUid, {
        uid: awayUid,
        gamerTag: readText(data.awayTag, awayUid.slice(0, 12) || "Player"),
        avatarUrl: null,
      });
    }
  }

  return [...players.values()].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

function normaliseProfile(value: unknown): TiebreakerProfile {
  return typeof value === "string" && (TIEBREAKER_PROFILES as readonly string[]).includes(value)
    ? (value as TiebreakerProfile)
    : DEFAULT_TIEBREAKER_PROFILE;
}

function buildSource(
  tournamentId: string,
  tournament: TournamentDocument,
  drawData: Record<string, unknown> | undefined,
  registrationsSnapshot: QuerySnapshot,
  matchesSnapshot: QuerySnapshot,
): StandingsSource {
  const fromDraw = drawStandingsPlayers(drawData);
  const fromRegistrations = readRegistrationPlayers(registrationsSnapshot);
  const players =
    fromDraw.length > 0
      ? fromDraw
      : fromRegistrations.length > 0
        ? fromRegistrations
        : matchParticipantPlayers(matchesSnapshot);

  return {
    tournamentId,
    profile: normaliseProfile(tournament.tiebreakerProfile),
    tiebreakSeed: drawTiebreakSeed(drawData) ?? fallbackTiebreakSeed(tournamentId),
    players,
    matches: readMatches(matchesSnapshot),
  };
}

/** Zero-match standings source built from the confirmed draw. */
export function standingsSourceFromDraw(
  tournamentId: string,
  tournament: TournamentDocument,
  drawData: Record<string, unknown> | undefined,
): StandingsSource {
  return {
    tournamentId,
    profile: normaliseProfile(tournament.tiebreakerProfile),
    tiebreakSeed: drawTiebreakSeed(drawData) ?? fallbackTiebreakSeed(tournamentId),
    players: drawStandingsPlayers(drawData),
    matches: [],
  };
}

/** Reads everything a standings rebuild needs inside a transaction. */
export interface StandingsTransactionContext {
  readonly source: StandingsSource;
  readonly tournamentSnapshot: DocumentSnapshot;
  readonly tournament: TournamentDocument;
  readonly matchDocs: readonly QueryDocumentSnapshot[];
}

export async function readStandingsContextInTransaction(
  transaction: Transaction,
  tournamentId: string,
): Promise<StandingsTransactionContext> {
  const firestore = getFirebaseAdminFirestore();

  const [tournamentSnapshot, drawSnapshot, registrationsSnapshot, matchesSnapshot] =
    await Promise.all([
      transaction.get(firestore.doc(paths.tournament(tournamentId))),
      transaction.get(firestore.doc(paths.tournamentDrawCurrent(tournamentId))),
      transaction.get(firestore.collection(paths.tournamentRegistrations(tournamentId))),
      transaction.get(firestore.collection(paths.tournamentMatches(tournamentId))),
    ]);

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as TournamentDocument;

  return {
    source: buildSource(
      tournamentId,
      tournament,
      drawSnapshot.data(),
      registrationsSnapshot,
      matchesSnapshot,
    ),
    tournamentSnapshot,
    tournament,
    matchDocs: matchesSnapshot.docs,
  };
}

/** The read-only source without the raw match documents. */
export async function readStandingsSourceInTransaction(
  transaction: Transaction,
  tournamentId: string,
): Promise<StandingsSource> {
  return (await readStandingsContextInTransaction(transaction, tournamentId)).source;
}

async function readStandingsSource(
  tournamentId: string,
): Promise<{ source: StandingsSource; standings: QuerySnapshot }> {
  const firestore = getFirebaseAdminFirestore();

  const [
    tournamentSnapshot,
    drawSnapshot,
    registrationsSnapshot,
    matchesSnapshot,
    standingsSnapshot,
  ] = await Promise.all([
    firestore.doc(paths.tournament(tournamentId)).get(),
    firestore.doc(paths.tournamentDrawCurrent(tournamentId)).get(),
    firestore.collection(paths.tournamentRegistrations(tournamentId)).get(),
    firestore.collection(paths.tournamentMatches(tournamentId)).get(),
    firestore.collection(paths.tournamentStandings(tournamentId)).get(),
  ]);

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  return {
    source: buildSource(
      tournamentId,
      tournamentSnapshot.data() as TournamentDocument,
      drawSnapshot.data(),
      registrationsSnapshot,
      matchesSnapshot,
    ),
    standings: standingsSnapshot,
  };
}

function writeFromRow(
  tournamentId: string,
  player: StandingsPlayerIdentity,
  row: StandingRow,
  provisional: boolean,
  updatedAt: Timestamp,
): StandingWrite {
  return {
    tournamentId,
    gamerTag: player.gamerTag,
    avatarUrl: player.avatarUrl,
    lot: row.lot,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    awayGoals: row.awayGoals,
    wins: row.wins,
    awayWins: row.awayWins,
    opponentPoints: row.opponentPoints,
    opponentGoalDifference: row.opponentGoalDifference,
    opponentGoalsFor: row.opponentGoalsFor,
    form: [...row.form],
    position: row.position,
    separatedBy: row.separatedBy,
    band: row.band,
    provisional,
    updatedAt,
  };
}

/**
 * Computes the complete table and the documents to write. Pending results
 * replace the stored result for those match ids: a non-null value is a result
 * being entered or corrected, `null` is a result being cleared.
 */
export function buildStandingsPlan(
  source: StandingsSource,
  pending: PendingResults = new Map(),
  updatedAt: Timestamp = Timestamp.now(),
): StandingsPlan {
  const identities = new Map(source.players.map((player) => [player.uid, player] as const));
  const enginePlayers: StandingsPlayer[] = source.players.map((player) => ({
    id: player.uid,
    lot: deriveLot(source.tiebreakSeed, player.uid),
  }));

  const matches: StandingsMatch[] = [];

  for (const match of source.matches) {
    const effective = pending.has(match.id) ? pending.get(match.id) : match.result;

    if (!effective) {
      continue;
    }

    if (!identities.has(match.homeUid) || !identities.has(match.awayUid)) {
      throw new TournamentMutationError(
        `Match ${match.id} references a player outside the confirmed field.`,
        409,
      );
    }

    matches.push({
      id: match.id,
      matchday: match.matchday,
      homeId: match.homeUid,
      awayId: match.awayUid,
      homeGoals: effective.homeGoals,
      awayGoals: effective.awayGoals,
    });
  }

  const rows = computeStandings({
    players: enginePlayers,
    matches,
    profile: source.profile,
  });
  const provisional = matches.length < LEAGUE_MATCH_TOTAL;
  const documents = rows.map((row) => {
    const player = identities.get(row.id);

    if (!player) {
      throw new TournamentMutationError("Standings row has no matching player.", 500);
    }

    return {
      uid: row.id,
      data: writeFromRow(source.tournamentId, player, row, provisional, updatedAt),
    };
  });

  return {
    rows,
    players: source.players,
    documents,
    leagueMatchesCompleted: matches.length,
    provisional,
    profile: source.profile,
    updatedAt,
  };
}

/** Stages the 36 standing documents. The caller updates the tournament. */
export function stageStandingsWrites(
  transaction: Transaction,
  tournamentId: string,
  plan: StandingsPlan,
): void {
  const firestore = getFirebaseAdminFirestore();

  for (const document of plan.documents) {
    transaction.set(
      firestore.doc(paths.tournamentStanding(tournamentId, document.uid)),
      document.data,
    );
  }
}

/** Tournament fields that always move together with the table. */
export function standingsTournamentPatch(plan: StandingsPlan): {
  leagueMatchesCompleted: number;
  standingsUpdatedAt: Timestamp;
} {
  return {
    leagueMatchesCompleted: plan.leagueMatchesCompleted,
    standingsUpdatedAt: plan.updatedAt,
  };
}

/** Guarded read for the organiser Standings tab. */
export async function getOrganiserStandings(tournamentId: string): Promise<StandingsView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.collection(paths.tournamentStandings(tournamentId)).get();
  const rows = snapshot.docs
    .map((document) => ({ ...(document.data() as StandingWrite), uid: document.id }))
    .sort((a, b) => a.position - b.position);

  return {
    tournament: access.tournament,
    rows,
    profile: normaliseProfile(access.tournament.tiebreakerProfile),
    provisional: (access.tournament.leagueMatchesCompleted ?? 0) < LEAGUE_MATCH_TOTAL,
    updatedAt:
      typeof access.tournament.standingsUpdatedAt === "object" &&
      access.tournament.standingsUpdatedAt !== null &&
      "toDate" in access.tournament.standingsUpdatedAt
        ? access.tournament.standingsUpdatedAt.toDate().toISOString()
        : null,
  };
}

/**
 * Rebuilds every standing document from scratch and records the repair in the
 * audit log. This is the only manual trigger; it never accepts table values.
 */
export async function recalculateStandings(tournamentId: string): Promise<{
  readonly players: number;
  readonly completedMatches: number;
  readonly profile: TiebreakerProfile;
}> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));

  const summary = await firestore.runTransaction(async (transaction) => {
    const source = await readStandingsSourceInTransaction(transaction, tournamentId);
    const plan = buildStandingsPlan(source);

    stageStandingsWrites(transaction, tournamentId, plan);
    transaction.update(tournamentRef, {
      ...standingsTournamentPatch(plan),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      players: plan.documents.length,
      completedMatches: plan.leagueMatchesCompleted,
      profile: plan.profile,
    };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "standings.recalculated",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: null,
    after: summary,
    reason: "Manual standings repair",
  });

  return summary;
}

const VERIFIED_FIELDS = [
  "tournamentId",
  "gamerTag",
  "avatarUrl",
  "lot",
  "played",
  "won",
  "drawn",
  "lost",
  "goalsFor",
  "goalsAgainst",
  "goalDifference",
  "points",
  "awayGoals",
  "wins",
  "awayWins",
  "opponentPoints",
  "opponentGoalDifference",
  "opponentGoalsFor",
  "form",
  "position",
  "separatedBy",
  "band",
  "provisional",
] as const;

function sameField(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  return expected === actual;
}

/**
 * Compares every stored standing document with a fresh computation. Read-only:
 * a mismatch is reported, never repaired.
 */
export async function verifyStandings(tournamentId: string): Promise<StandingsVerifyResult> {
  await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const { source, standings } = await readStandingsSource(tournamentId);
  const plan = buildStandingsPlan(source);
  const expected = new Map(
    plan.documents.map((document) => [document.uid, document.data] as const),
  );
  const stored = new Map<string, Record<string, unknown>>(
    standings.docs.map((document: QueryDocumentSnapshot) => [
      document.id,
      document.data() as Record<string, unknown>,
    ]),
  );

  const missing = [...expected.keys()]
    .filter((uid) => !stored.has(uid))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const unexpected = [...stored.keys()]
    .filter((uid) => !expected.has(uid))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mismatches: StandingsVerifyIssue[] = [];

  for (const [uid, expectedDocument] of expected) {
    const storedDocument = stored.get(uid);

    if (!storedDocument) {
      continue;
    }

    const fields = VERIFIED_FIELDS.filter(
      (field) =>
        !sameField(
          (expectedDocument as unknown as Record<string, unknown>)[field],
          storedDocument[field],
        ),
    );

    if (fields.length > 0) {
      mismatches.push({ uid, fields });
    }
  }

  return {
    valid: missing.length === 0 && unexpected.length === 0 && mismatches.length === 0,
    checked: stored.size,
    completedMatches: plan.leagueMatchesCompleted,
    profile: plan.profile,
    missing,
    unexpected,
    mismatches,
  };
}

/** Plain summary used by the connection guard and tests. */
export async function standingsStatus(tournamentId: string): Promise<{
  readonly profile: TiebreakerProfile;
  readonly completedMatches: number;
  readonly provisional: boolean;
}> {
  const { source } = await readStandingsSource(tournamentId);
  const plan = buildStandingsPlan(source);

  return {
    profile: plan.profile,
    completedMatches: plan.leagueMatchesCompleted,
    provisional: plan.provisional,
  };
}
