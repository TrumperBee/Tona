// GCC - league-phase fixture generation, publication, verification and reset.
//
// All mutations re-read the tournament, the confirmed draw and the draft in one
// Firestore transaction before writing. The server generates the seed with
// `crypto.randomBytes`; the client never supplies fixtures or tags. Generation
// is validated by the independent engine validator, and publication re-runs
// that validation plus the canonical SHA-256 check against the stored draft.
//
// Publication writes exactly 144 matches, eight matchday windows and 36 zeroed
// standings: 188 documents, well inside Firestore's 500-write transaction limit.
import "server-only";

import { randomBytes } from "node:crypto";

import { FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import {
  FIXTURE_ALGORITHM_VERSION,
  generateLeaguePhase,
  validateLeaguePhase,
  validatePots,
  type GeneratedFixture,
  type LeaguePhaseReport,
  type LeaguePhaseValidationStats,
} from "@/lib/engine";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotifications } from "@/lib/notifications";
import { TournamentMutationError } from "@/lib/tournament/errors";
import {
  buildStandingsPlan,
  standingsSourceFromDraw,
  standingsTournamentPatch,
  stageStandingsWrites,
} from "@/lib/tournament/standings";
import { canonicalScheduleHash } from "@/lib/tournament/fixture-hash";
import type { FixtureWindowInput } from "@/lib/validation/fixtures";
import type {
  DrawPlayerSnapshot,
  MatchStatus,
  PotNumber,
  TournamentDocument,
} from "@/types/domain";

const POT_KEYS = ["1", "2", "3", "4"] as const;
const SEED_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;
const MATCHDAY_COUNT = 8;
const MATCHES_PER_MATCHDAY = 18;
const MATCH_COUNT = MATCHDAY_COUNT * MATCHES_PER_MATCHDAY;
const PLAYER_COUNT = 36;

interface StoredDraftFixture {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: Timestamp | null;
}

interface StoredDraftValidation {
  readonly valid: boolean;
  readonly issues: readonly { readonly code: string; readonly message: string }[];
}

interface StoredDraft {
  readonly seed: string;
  readonly algorithmVersion: number;
  readonly fixtures: readonly StoredDraftFixture[];
  readonly report: LeaguePhaseReport;
  readonly stats: LeaguePhaseValidationStats;
  readonly scheduleHash: string;
  readonly generatedBy: string;
  readonly generatedAt: Timestamp;
  readonly generationCount: number;
  readonly validation: StoredDraftValidation;
}

interface ConfirmedDraw {
  readonly pots: Record<PotNumber, string[]>;
  readonly playersSnapshot: Record<string, DrawPlayerSnapshot>;
  readonly shuffleSeed: string | null;
  readonly confirmedAt: Timestamp;
}

export interface OrganiserFixturePlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
  readonly pot: number;
}

export interface OrganiserFixtureRow {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: string | null;
  readonly status: MatchStatus;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export interface OrganiserMatchdayWindow {
  readonly number: number;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface OrganiserDraft {
  readonly seed: string;
  readonly algorithmVersion: number;
  readonly fixtures: readonly OrganiserFixtureRow[];
  readonly report: LeaguePhaseReport;
  readonly stats: LeaguePhaseValidationStats;
  readonly scheduleHash: string;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly generationCount: number;
  readonly validation: StoredDraftValidation;
}

export interface OrganiserFixturesView {
  readonly tournament: TournamentDocument;
  readonly draft: OrganiserDraft | null;
  readonly matchdays: readonly OrganiserMatchdayWindow[];
  readonly matches: readonly OrganiserFixtureRow[];
  readonly hasResults: boolean;
  readonly scheduleHash: string | null;
  readonly fixturesPublishedAt: string | null;
  readonly players: readonly OrganiserFixturePlayer[];
}

export interface FixtureIntegrityIssue {
  readonly code: string;
  readonly message: string;
}

export interface FixtureIntegrityResult {
  readonly valid: boolean;
  readonly matchCount: number;
  readonly matchdayCount: number;
  readonly hash: string | null;
  readonly storedHash: string | null;
  readonly issues: readonly FixtureIntegrityIssue[];
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [];
}

function readPots(value: unknown): Record<PotNumber, string[]> {
  const pots: Record<PotNumber, string[]> = { "1": [], "2": [], "3": [], "4": [] };

  if (typeof value !== "object" || value === null) {
    return pots;
  }

  const record = value as Record<string, unknown>;

  for (const key of POT_KEYS) {
    pots[key] = readStringArray(record[key]);
  }

  return pots;
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

function toIsoString(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function readConfirmedDraw(
  data: Record<string, unknown> | undefined,
  registeredIds: readonly string[],
): ConfirmedDraw {
  if (!data || data.status !== "confirmed" || !data.confirmedAt) {
    throw new TournamentMutationError("Confirm the draw before generating fixtures.", 409);
  }

  const pots = readPots(data.pots);
  const validation = validatePots(pots, registeredIds);

  if (!validation.valid) {
    throw new TournamentMutationError(
      `The confirmed draw is no longer valid: ${validation.issues
        .map((issue) => issue.message)
        .join(" ")}`,
      409,
    );
  }

  return {
    pots,
    playersSnapshot: readSnapshotMap(data.playersSnapshot),
    shuffleSeed: typeof data.shuffleSeed === "string" ? data.shuffleSeed : null,
    confirmedAt: data.confirmedAt as Timestamp,
  };
}

function potsInOrder(pots: Record<PotNumber, string[]>): string[][] {
  return [pots["1"], pots["2"], pots["3"], pots["4"]];
}

function fallbackTag(playerId: string): string {
  // Display fallback only; a confirmed draw always carries a real gamer tag.
  return playerId.slice(0, 12) || "Player";
}

function readDraftFixtures(value: unknown): StoredDraftFixture[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const fixtures: StoredDraftFixture[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const data = entry as Record<string, unknown>;

    if (
      typeof data.id !== "string" ||
      typeof data.matchday !== "number" ||
      typeof data.homeUid !== "string" ||
      typeof data.awayUid !== "string"
    ) {
      continue;
    }

    fixtures.push({
      id: data.id,
      matchday: data.matchday,
      homeUid: data.homeUid,
      awayUid: data.awayUid,
      homeTag: typeof data.homeTag === "string" ? data.homeTag : fallbackTag(data.homeUid),
      awayTag: typeof data.awayTag === "string" ? data.awayTag : fallbackTag(data.awayUid),
      scheduledAt: (data.scheduledAt as Timestamp | null | undefined) ?? null,
    });
  }

  return fixtures;
}

function readReport(value: unknown): LeaguePhaseReport | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.algorithmVersion !== "number" ||
    typeof data.attemptSeed !== "string" ||
    typeof data.attempts !== "number" ||
    !Array.isArray(data.perMatchdayCounts)
  ) {
    return null;
  }

  return {
    algorithmVersion: data.algorithmVersion,
    attemptSeed: data.attemptSeed,
    attempts: data.attempts,
    colouringNodes: typeof data.colouringNodes === "number" ? data.colouringNodes : 0,
    maxHomeAwayStreak: typeof data.maxHomeAwayStreak === "number" ? data.maxHomeAwayStreak : 0,
    playersWithStreak3Plus:
      typeof data.playersWithStreak3Plus === "number" ? data.playersWithStreak3Plus : 0,
    perMatchdayCounts: data.perMatchdayCounts.filter(
      (count): count is number => typeof count === "number",
    ),
  };
}

function readStats(value: unknown): LeaguePhaseValidationStats | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (!Array.isArray(data.perPlayer) || !Array.isArray(data.perMatchdayCounts)) {
    return null;
  }

  return {
    matchCount: typeof data.matchCount === "number" ? data.matchCount : 0,
    perMatchdayCounts: data.perMatchdayCounts.filter(
      (count): count is number => typeof count === "number",
    ),
    perPlayer: data.perPlayer.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const player = entry as Record<string, unknown>;

      if (
        typeof player.playerId !== "string" ||
        typeof player.pot !== "number" ||
        typeof player.home !== "number" ||
        typeof player.away !== "number" ||
        !Array.isArray(player.opponentsByPot) ||
        !Array.isArray(player.homeByPot) ||
        !Array.isArray(player.awayByPot)
      ) {
        return [];
      }

      return [
        {
          playerId: player.playerId,
          pot: player.pot,
          home: player.home,
          away: player.away,
          homeByPot: player.homeByPot.filter((count): count is number => typeof count === "number"),
          awayByPot: player.awayByPot.filter((count): count is number => typeof count === "number"),
          opponentsByPot: player.opponentsByPot.filter(
            (count): count is number => typeof count === "number",
          ),
        },
      ];
    }),
  };
}

function readStoredDraft(data: Record<string, unknown> | undefined): StoredDraft | null {
  if (!data || typeof data.scheduleHash !== "string" || !Array.isArray(data.fixtures)) {
    return null;
  }

  const report = readReport(data.report);
  const stats = readStats(data.stats);

  if (!report || !stats || typeof data.seed !== "string") {
    return null;
  }

  return {
    seed: data.seed,
    algorithmVersion:
      typeof data.algorithmVersion === "number" ? data.algorithmVersion : FIXTURE_ALGORITHM_VERSION,
    fixtures: readDraftFixtures(data.fixtures),
    report,
    stats,
    scheduleHash: data.scheduleHash,
    generatedBy: typeof data.generatedBy === "string" ? data.generatedBy : "",
    generatedAt: (data.generatedAt as Timestamp | undefined) ?? Timestamp.now(),
    generationCount: typeof data.generationCount === "number" ? data.generationCount : 1,
    validation: {
      valid:
        typeof data.validation === "object" &&
        data.validation !== null &&
        (data.validation as { valid?: unknown }).valid === true,
      issues:
        typeof data.validation === "object" &&
        data.validation !== null &&
        Array.isArray((data.validation as { issues?: unknown }).issues)
          ? ((data.validation as { issues: { code: string; message: string }[] }).issues ?? [])
          : [],
    },
  };
}

function draftWrite(draft: StoredDraft): Record<string, unknown> {
  return {
    seed: draft.seed,
    algorithmVersion: draft.algorithmVersion,
    fixtures: draft.fixtures,
    report: draft.report,
    stats: draft.stats,
    scheduleHash: draft.scheduleHash,
    generatedBy: draft.generatedBy,
    generatedAt: draft.generatedAt,
    generationCount: draft.generationCount,
    validation: draft.validation,
  };
}

function readRegistrationPlayers(snapshot: QuerySnapshot): {
  ids: string[];
  snapshots: Record<string, DrawPlayerSnapshot>;
} {
  const ids: string[] = [];
  const snapshots: Record<string, DrawPlayerSnapshot> = {};

  for (const document of snapshot.docs) {
    const data = document.data();

    if (data.status !== "registered") {
      continue;
    }

    ids.push(document.id);
    snapshots[document.id] = {
      gamerTag: typeof data.gamerTag === "string" ? data.gamerTag : fallbackTag(document.id),
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: typeof data.country === "string" ? data.country : "",
    };
  }

  return { ids, snapshots };
}

function fixtureId(matchday: number, index: number): string {
  return `league-md${String(matchday).padStart(2, "0")}-m${String(index).padStart(2, "0")}`;
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function sortedFixtures(fixtures: readonly GeneratedFixture[]): GeneratedFixture[] {
  return [...fixtures].sort((a, b) => {
    if (a.matchday !== b.matchday) {
      return a.matchday - b.matchday;
    }

    const home = compareText(a.homeId, b.homeId);
    return home !== 0 ? home : compareText(a.awayId, b.awayId);
  });
}

function buildDraftFixtures(
  fixtures: readonly GeneratedFixture[],
  snapshots: Readonly<Record<string, DrawPlayerSnapshot>>,
): StoredDraftFixture[] {
  const counters = new Map<number, number>();

  return sortedFixtures(fixtures).map((fixture) => {
    const next = (counters.get(fixture.matchday) ?? 0) + 1;
    counters.set(fixture.matchday, next);

    return {
      id: fixtureId(fixture.matchday, next),
      matchday: fixture.matchday,
      homeUid: fixture.homeId,
      awayUid: fixture.awayId,
      homeTag: snapshots[fixture.homeId]?.gamerTag ?? fallbackTag(fixture.homeId),
      awayTag: snapshots[fixture.awayId]?.gamerTag ?? fallbackTag(fixture.awayId),
      scheduledAt: null,
    };
  });
}

function parseWindowDate(value: string, label: string): Timestamp {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TournamentMutationError(`${label} is not a valid date.`, 400);
  }

  return Timestamp.fromDate(date);
}

interface ResolvedWindow {
  readonly number: number;
  readonly startsOn: Timestamp;
  readonly endsOn: Timestamp;
}

function defaultWindows(tournament: TournamentDocument): ResolvedWindow[] {
  if (!tournament.startsAt) {
    throw new TournamentMutationError(
      "Set the competition start date before publishing fixtures.",
      409,
    );
  }

  const start = tournament.startsAt.toDate();

  return Array.from({ length: MATCHDAY_COUNT }, (_, index) => {
    const startsOn = new Date(start.getTime() + index * 7 * DAY_MS);
    const endsOn = new Date(startsOn.getTime() + 6 * DAY_MS);

    return {
      number: index + 1,
      startsOn: Timestamp.fromDate(startsOn),
      endsOn: Timestamp.fromDate(endsOn),
    };
  });
}

function resolveWindows(
  tournament: TournamentDocument,
  windows: readonly FixtureWindowInput[] | undefined,
): ResolvedWindow[] {
  if (!windows) {
    return defaultWindows(tournament);
  }

  if (windows.length !== MATCHDAY_COUNT) {
    throw new TournamentMutationError(
      `Publishing needs exactly ${MATCHDAY_COUNT} matchday windows.`,
      400,
    );
  }

  const seen = new Set<number>();
  const resolved: ResolvedWindow[] = [];

  for (const window of windows) {
    if (window.number < 1 || window.number > MATCHDAY_COUNT) {
      throw new TournamentMutationError("A matchday number must be between 1 and 8.", 400);
    }

    if (seen.has(window.number)) {
      throw new TournamentMutationError(`Matchday ${window.number} appears twice.`, 400);
    }

    seen.add(window.number);

    const startsOn = parseWindowDate(window.startsOn, `Matchday ${window.number} start`);
    const endsOn = parseWindowDate(window.endsOn, `Matchday ${window.number} end`);

    if (endsOn.toMillis() < startsOn.toMillis()) {
      throw new TournamentMutationError(`Matchday ${window.number} ends before it starts.`, 400);
    }

    resolved.push({ number: window.number, startsOn, endsOn });
  }

  return resolved.sort((a, b) => a.number - b.number);
}

function newSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

function draftFixtureToRow(fixture: StoredDraftFixture): OrganiserFixtureRow {
  return {
    id: fixture.id,
    matchday: fixture.matchday,
    homeUid: fixture.homeUid,
    awayUid: fixture.awayUid,
    homeTag: fixture.homeTag,
    awayTag: fixture.awayTag,
    scheduledAt: toIsoString(fixture.scheduledAt),
    status: "scheduled",
    homeGoals: null,
    awayGoals: null,
  };
}

function matchToRow(id: string, data: Record<string, unknown>): OrganiserFixtureRow {
  const result =
    typeof data.result === "object" && data.result !== null
      ? (data.result as Record<string, unknown>)
      : null;

  return {
    id,
    matchday: typeof data.matchday === "number" ? data.matchday : 0,
    homeUid: typeof data.homeUid === "string" ? data.homeUid : "",
    awayUid: typeof data.awayUid === "string" ? data.awayUid : "",
    homeTag: typeof data.homeTag === "string" ? data.homeTag : "Player",
    awayTag: typeof data.awayTag === "string" ? data.awayTag : "Player",
    scheduledAt: toIsoString(data.scheduledAt),
    status: data.status === "completed" ? "completed" : "scheduled",
    homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
    awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
  };
}

/** Guarded read for the organiser fixtures page. */
export async function getOrganiserFixtures(tournamentId: string): Promise<OrganiserFixturesView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();

  const [draftSnapshot, matchdaysSnapshot, matchesSnapshot, drawSnapshot, registrationsSnapshot] =
    await Promise.all([
      firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId)).get(),
      firestore.collection(paths.tournamentMatchdays(tournamentId)).get(),
      firestore.collection(paths.tournamentMatches(tournamentId)).get(),
      firestore.doc(paths.tournamentDrawCurrent(tournamentId)).get(),
      firestore
        .collection(paths.tournamentRegistrations(tournamentId))
        .where("status", "==", "registered")
        .get(),
    ]);

  const storedDraft = readStoredDraft(draftSnapshot.data());
  const drawData = drawSnapshot.data();
  const drawPots = readPots(drawData?.pots);
  const snapshots = {
    ...readRegistrationPlayers(registrationsSnapshot).snapshots,
    ...readSnapshotMap(drawData?.playersSnapshot),
  };

  const players: OrganiserFixturePlayer[] = [];

  for (const key of POT_KEYS) {
    for (const uid of drawPots[key]) {
      const snapshot = snapshots[uid];

      players.push({
        uid,
        gamerTag: snapshot?.gamerTag ?? fallbackTag(uid),
        avatarUrl: snapshot?.avatarUrl ?? null,
        country: snapshot?.country ?? "",
        pot: Number(key),
      });
    }
  }

  const matchdays = matchdaysSnapshot.docs
    .map((document) => {
      const data = document.data();
      const number = typeof data.number === "number" ? data.number : Number(document.id);
      const startsOn = toIsoString(data.startsOn);
      const endsOn = toIsoString(data.endsOn);

      if (!Number.isInteger(number) || !startsOn || !endsOn) {
        return null;
      }

      return { number, startsOn, endsOn };
    })
    .filter((entry): entry is OrganiserMatchdayWindow => entry !== null)
    .sort((a, b) => a.number - b.number);

  const matches = matchesSnapshot.docs
    .map((document) => matchToRow(document.id, document.data()))
    .sort((a, b) => {
      if (a.matchday !== b.matchday) {
        return a.matchday - b.matchday;
      }

      return compareText(a.id, b.id);
    });

  const draft: OrganiserDraft | null = storedDraft
    ? {
        seed: storedDraft.seed,
        algorithmVersion: storedDraft.algorithmVersion,
        fixtures: storedDraft.fixtures.map((fixture) => draftFixtureToRow(fixture)),
        report: storedDraft.report,
        stats: storedDraft.stats,
        scheduleHash: storedDraft.scheduleHash,
        generatedAt: toIsoString(storedDraft.generatedAt) ?? "",
        generatedBy: storedDraft.generatedBy,
        generationCount: storedDraft.generationCount,
        validation: storedDraft.validation,
      }
    : null;

  return {
    tournament: access.tournament,
    draft,
    matchdays,
    matches,
    hasResults: matches.some(
      (match) =>
        match.status === "completed" || match.homeGoals !== null || match.awayGoals !== null,
    ),
    scheduleHash: access.tournament.scheduleHash ?? null,
    fixturesPublishedAt: toIsoString(access.tournament.fixturesPublishedAt),
    players,
  };
}

export interface GenerateFixturesResult {
  readonly seed: string;
  readonly scheduleHash: string;
  readonly generationCount: number;
  readonly attempts: number;
}

/**
 * Generates a fresh draft from the confirmed pots. The seed is server-generated
 * and the output is validated before anything is stored. A previous draft is
 * overwritten only while the tournament is still at `pots_confirmed`.
 */
export async function generateFixtures(tournamentId: string): Promise<GenerateFixturesResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);

  if (access.tournament.status !== "pots_confirmed") {
    throw new TournamentMutationError(
      "Fixtures can only be generated after the draw is confirmed and before they are published.",
      409,
    );
  }

  const firestore = getFirebaseAdminFirestore();
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const draftRef = firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId));
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));

  const [drawSnapshot, registrationsSnapshot] = await Promise.all([
    drawRef.get(),
    firestore
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered")
      .get(),
  ]);

  const registrations = readRegistrationPlayers(registrationsSnapshot);
  const draw = readConfirmedDraw(drawSnapshot.data(), registrations.ids);
  const pots = potsInOrder(draw.pots);

  if (registrations.ids.length !== PLAYER_COUNT) {
    throw new TournamentMutationError(
      `Fixtures need exactly ${PLAYER_COUNT} registered players.`,
      409,
    );
  }

  const seed = newSeed();
  let generation;

  try {
    generation = generateLeaguePhase({ pots, seed });
  } catch (error) {
    throw new TournamentMutationError(
      error instanceof Error ? error.message : "Fixture generation failed.",
      500,
    );
  }

  const validation = validateLeaguePhase(pots, generation.fixtures);

  if (!validation.valid) {
    throw new TournamentMutationError(
      `The generated schedule did not pass validation: ${validation.errors
        .map((error) => error.message)
        .join(" ")}`,
      500,
    );
  }

  const scheduleHash = canonicalScheduleHash(generation.fixtures);
  const fixtures = buildDraftFixtures(generation.fixtures, {
    ...draw.playersSnapshot,
    ...registrations.snapshots,
  });

  const result = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const currentDrawSnapshot = await transaction.get(drawRef);
    const draftSnapshot = await transaction.get(draftRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "pots_confirmed") {
      throw new TournamentMutationError(
        "Fixtures can only be generated after the draw is confirmed and before they are published.",
        409,
      );
    }

    const currentDraw = readConfirmedDraw(
      currentDrawSnapshot.data(),
      Object.values(draw.pots).flat(),
    );

    if (
      currentDraw.shuffleSeed !== draw.shuffleSeed ||
      JSON.stringify(currentDraw.pots) !== JSON.stringify(draw.pots)
    ) {
      throw new TournamentMutationError(
        "The confirmed draw changed while fixtures were generated. Try again.",
        409,
      );
    }

    const previous = readStoredDraft(draftSnapshot.data());
    const generationCount = (previous?.generationCount ?? 0) + 1;
    const now = Timestamp.now();
    const draft: StoredDraft = {
      seed,
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      fixtures,
      report: generation.report,
      stats: validation.stats,
      scheduleHash,
      generatedBy: access.user.userId,
      generatedAt: now,
      generationCount,
      validation: {
        valid: true,
        issues: [],
      },
    };

    transaction.set(draftRef, draftWrite(draft));

    return { generationCount, previousHash: previous?.scheduleHash ?? null };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.fixtures.generated",
    targetType: "fixtureDraft",
    targetId: tournamentId,
    tournamentId,
    before: { scheduleHash: result.previousHash },
    after: {
      scheduleHash,
      seed,
      algorithmVersion: FIXTURE_ALGORITHM_VERSION,
      attempts: generation.attempts,
      generationCount: result.generationCount,
    },
  });

  return {
    seed,
    scheduleHash,
    generationCount: result.generationCount,
    attempts: generation.attempts,
  };
}

export interface PublishFixturesResult {
  readonly scheduleHash: string;
  readonly matchCount: number;
  readonly matchdayCount: number;
  readonly standingsCount: number;
}

/**
 * Publishes the stored draft as 144 deterministic matches, eight matchday
 * windows and 36 zeroed standings. Re-validates and re-hashes inside the
 * transaction; a concurrent second publish loses the tournament document
 * conflict and then sees the new status.
 */
export async function publishFixtures(
  tournamentId: string,
  windows: readonly FixtureWindowInput[] | undefined,
): Promise<PublishFixturesResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const draftRef = firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId));
  const matchesQuery = firestore.collection(paths.tournamentMatches(tournamentId)).limit(1);
  const resolvedWindows = resolveWindows(access.tournament, windows);

  const result = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const draftSnapshot = await transaction.get(draftRef);
    const existingMatches = await transaction.get(matchesQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "pots_confirmed") {
      throw new TournamentMutationError(
        "The schedule can only be published after the draw is confirmed and before it is published.",
        409,
      );
    }

    if (!existingMatches.empty) {
      throw new TournamentMutationError("This tournament already has matches.", 409);
    }

    const draft = readStoredDraft(draftSnapshot.data());

    if (!draft || draft.fixtures.length !== MATCH_COUNT) {
      throw new TournamentMutationError(
        "Generate and validate the schedule before publishing it.",
        409,
      );
    }

    const draw = readConfirmedDraw(
      drawSnapshot.data(),
      Object.values(readPots(drawSnapshot.data()?.pots)).flat(),
    );
    const pots = potsInOrder(draw.pots);
    const engineFixtures = draft.fixtures.map((fixture) => ({
      matchday: fixture.matchday,
      homeId: fixture.homeUid,
      awayId: fixture.awayUid,
    }));
    const validation = validateLeaguePhase(pots, engineFixtures);

    if (!validation.valid) {
      throw new TournamentMutationError(
        `The stored schedule is invalid: ${validation.errors
          .map((error) => error.message)
          .join(" ")}`,
        409,
      );
    }

    const hash = canonicalScheduleHash(engineFixtures);

    if (hash !== draft.scheduleHash) {
      throw new TournamentMutationError(
        "The stored schedule hash does not match its fixtures. Regenerate before publishing.",
        409,
      );
    }

    const now = Timestamp.now();
    const windowByMatchday = new Map(
      resolvedWindows.map((window) => [window.number, window] as const),
    );
    const snapshots = {
      ...readSnapshotMap(drawSnapshot.data()?.playersSnapshot),
    };
    const playerIds = Object.values(draw.pots).flat();

    for (const fixture of draft.fixtures) {
      const window = windowByMatchday.get(fixture.matchday);

      if (!window) {
        throw new TournamentMutationError(
          `Matchday ${fixture.matchday} has no publishing window.`,
          400,
        );
      }

      transaction.set(firestore.doc(paths.tournamentMatch(tournamentId, fixture.id)), {
        tournamentId,
        stage: "league",
        matchday: fixture.matchday,
        homeUid: fixture.homeUid,
        awayUid: fixture.awayUid,
        homeTag: snapshots[fixture.homeUid]?.gamerTag ?? fixture.homeTag,
        awayTag: snapshots[fixture.awayUid]?.gamerTag ?? fixture.awayTag,
        participants: [fixture.homeUid, fixture.awayUid],
        status: "scheduled",
        scheduledAt: window.startsOn,
        result: null,
        updatedAt: now,
      });
    }

    for (const window of resolvedWindows) {
      transaction.set(firestore.doc(paths.tournamentMatchday(tournamentId, window.number)), {
        number: window.number,
        startsOn: window.startsOn,
        endsOn: window.endsOn,
        createdAt: now,
        updatedAt: now,
      });
    }

    const standings = buildStandingsPlan(
      standingsSourceFromDraw(tournamentId, tournament, drawSnapshot.data()),
      new Map(),
      now,
    );

    stageStandingsWrites(transaction, tournamentId, standings);

    transaction.update(tournamentRef, {
      status: "fixtures_published",
      scheduleHash: hash,
      fixturesPublishedAt: now,
      ...standingsTournamentPatch(standings),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      scheduleHash: hash,
      slug: tournament.slug,
      name: tournament.name,
      playerIds,
    };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.fixtures.published",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: "pots_confirmed", scheduleHash: null },
    after: {
      status: "fixtures_published",
      scheduleHash: result.scheduleHash,
      matchCount: MATCH_COUNT,
      matchdayCount: MATCHDAY_COUNT,
      standingsCount: PLAYER_COUNT,
      windows: resolvedWindows.map((window) => ({
        number: window.number,
        startsOn: window.startsOn.toDate().toISOString(),
        endsOn: window.endsOn.toDate().toISOString(),
      })),
    },
  });

  // Small chunks keep each notification batch far below the 500-operation cap.
  for (let index = 0; index < result.playerIds.length; index += 18) {
    await createNotifications(result.playerIds.slice(index, index + 18), {
      type: "fixture",
      title: "Fixtures are published",
      body: `The eight-matchday league phase for ${result.name} is now available. Check your first match.`,
      link: `/tournaments/${result.slug}`,
    }).catch(() => undefined);
  }

  return {
    scheduleHash: result.scheduleHash,
    matchCount: MATCH_COUNT,
    matchdayCount: MATCHDAY_COUNT,
    standingsCount: PLAYER_COUNT,
  };
}

export interface ResetFixturesResult {
  readonly deletedMatches: number;
  readonly deletedMatchdays: number;
  readonly deletedStandings: number;
}

/**
 * Removes a published schedule only while no result exists. The draft is kept
 * so the organiser can publish it again; the tournament returns to
 * `pots_confirmed`.
 */
export async function resetFixtures(
  tournamentId: string,
  reason: string | undefined,
): Promise<ResetFixturesResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));

  const result = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "fixtures_published" && tournament.status !== "league_phase") {
      throw new TournamentMutationError("There are no published fixtures to reset.", 409);
    }

    const [matchesSnapshot, matchdaysSnapshot, standingsSnapshot] = await Promise.all([
      transaction.get(firestore.collection(paths.tournamentMatches(tournamentId))),
      transaction.get(firestore.collection(paths.tournamentMatchdays(tournamentId))),
      transaction.get(firestore.collection(paths.tournamentStandings(tournamentId))),
    ]);

    const hasResults = matchesSnapshot.docs.some((document) => {
      const data = document.data();
      return data.status === "completed" || (data.result !== null && data.result !== undefined);
    });

    if (hasResults) {
      throw new TournamentMutationError(
        "Results already exist. Fixtures cannot be reset after a result is recorded.",
        409,
      );
    }

    for (const document of matchesSnapshot.docs) {
      transaction.delete(document.ref);
    }

    for (const document of matchdaysSnapshot.docs) {
      transaction.delete(document.ref);
    }

    for (const document of standingsSnapshot.docs) {
      transaction.delete(document.ref);
    }

    transaction.update(tournamentRef, {
      status: "pots_confirmed",
      scheduleHash: null,
      fixturesPublishedAt: null,
      leagueMatchesCompleted: 0,
      standingsUpdatedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      deletedMatches: matchesSnapshot.size,
      deletedMatchdays: matchdaysSnapshot.size,
      deletedStandings: standingsSnapshot.size,
    };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.fixtures.reset",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: {
      status: access.tournament.status,
      scheduleHash: access.tournament.scheduleHash ?? null,
    },
    after: { status: "pots_confirmed", ...result },
    reason: reason ?? null,
  });

  return result;
}

/**
 * Rebuilds the fixture list from the stored matches and re-runs the independent
 * validator and canonical hash. It never mutates anything.
 */
export async function verifyFixtures(tournamentId: string): Promise<FixtureIntegrityResult> {
  await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();

  const [tournamentSnapshot, drawSnapshot, draftSnapshot, matchesSnapshot, matchdaysSnapshot] =
    await Promise.all([
      firestore.doc(paths.tournament(tournamentId)).get(),
      firestore.doc(paths.tournamentDrawCurrent(tournamentId)).get(),
      firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId)).get(),
      firestore.collection(paths.tournamentMatches(tournamentId)).get(),
      firestore.collection(paths.tournamentMatchdays(tournamentId)).get(),
    ]);

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const storedHash =
    typeof tournamentSnapshot.data()?.scheduleHash === "string"
      ? (tournamentSnapshot.data()?.scheduleHash as string)
      : null;
  const draft = readStoredDraft(draftSnapshot.data());
  const pots = readPots(drawSnapshot.data()?.pots);
  const fixtures = matchesSnapshot.docs.map((document) => {
    const data = document.data();

    return {
      matchday: typeof data.matchday === "number" ? data.matchday : 0,
      homeId: typeof data.homeUid === "string" ? data.homeUid : "",
      awayId: typeof data.awayUid === "string" ? data.awayUid : "",
    };
  });

  if (fixtures.length === 0) {
    return {
      valid: false,
      matchCount: 0,
      matchdayCount: matchdaysSnapshot.size,
      hash: null,
      storedHash,
      issues: [{ code: "no-fixtures", message: "No published matches exist to verify." }],
    };
  }

  const validation = validateLeaguePhase(potsInOrder(pots), fixtures);
  const hash = canonicalScheduleHash(fixtures);
  const issues: FixtureIntegrityIssue[] = validation.errors.map((error) => ({
    code: error.code,
    message: error.message,
  }));

  if (validation.stats.matchCount !== MATCH_COUNT) {
    issues.push({
      code: "match-count-invalid",
      message: `Expected ${MATCH_COUNT} matches; found ${validation.stats.matchCount}.`,
    });
  }

  if (matchdaysSnapshot.size !== MATCHDAY_COUNT) {
    issues.push({
      code: "matchday-count-invalid",
      message: `Expected ${MATCHDAY_COUNT} matchdays; found ${matchdaysSnapshot.size}.`,
    });
  }

  if (!storedHash || hash !== storedHash) {
    issues.push({
      code: "hash-mismatch",
      message: "The stored match list does not match the published schedule hash.",
    });
  }

  if (draft && draft.scheduleHash !== hash) {
    issues.push({
      code: "draft-hash-mismatch",
      message: "The stored match list does not match the draft it was published from.",
    });
  }

  return {
    valid: issues.length === 0,
    matchCount: fixtures.length,
    matchdayCount: matchdaysSnapshot.size,
    hash,
    storedHash,
    issues,
  };
}

/** Updates one informational matchday window. Allowed at any published stage. */
export async function updateMatchdayWindow(
  tournamentId: string,
  matchday: number,
  startsOnInput: string,
  endsOnInput: string,
): Promise<{ number: number; startsOn: string; endsOn: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const matchdayRef = firestore.doc(paths.tournamentMatchday(tournamentId, matchday));

  if (!Number.isInteger(matchday) || matchday < 1 || matchday > MATCHDAY_COUNT) {
    throw new TournamentMutationError("A matchday number must be between 1 and 8.", 400);
  }

  const startsOn = parseWindowDate(startsOnInput, `Matchday ${matchday} start`);
  const endsOn = parseWindowDate(endsOnInput, `Matchday ${matchday} end`);

  if (endsOn.toMillis() < startsOn.toMillis()) {
    throw new TournamentMutationError(`Matchday ${matchday} ends before it starts.`, 400);
  }

  const existing = await matchdayRef.get();

  if (!existing.exists) {
    throw new TournamentMutationError("That matchday has not been published.", 404);
  }

  const before = existing.data() ?? {};

  await matchdayRef.update({
    startsOn,
    endsOn,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.matchday.window_updated",
    targetType: "matchday",
    targetId: `${tournamentId}/${matchday}`,
    tournamentId,
    before: {
      startsOn: toIsoString(before.startsOn),
      endsOn: toIsoString(before.endsOn),
    },
    after: {
      startsOn: startsOn.toDate().toISOString(),
      endsOn: endsOn.toDate().toISOString(),
    },
  });

  return {
    number: matchday,
    startsOn: startsOn.toDate().toISOString(),
    endsOn: endsOn.toDate().toISOString(),
  };
}
