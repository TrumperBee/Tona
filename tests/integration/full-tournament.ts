// GCC - shared full-tournament simulator for Phase 13C.
//
// It drives the real route handlers against the Firebase emulators: shuffles and
// confirms the draw, generates and publishes the 144 league fixtures, records
// every league result in bulk, then takes the single "generate knockout stage"
// action. After that every knockout leg is entered through the ordinary result
// routes, which advance the winner and create the next matches automatically,
// until the final completes the tournament. The knockout integration test uses
// it as its end-to-end case and `npm run simulate` prints the same summary.
//
// The caller must mock `next/headers` (session cookie) before importing this
// module. Route handlers are imported dynamically so that mock is in place.
import { NextRequest } from "next/server";

import { KNOCKOUT_ROUNDS, KNOCKOUT_ROUND_TIE_COUNTS } from "@/lib/engine/knockout";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

const PASSWORD = "correct horse battery";
const PLAYER_COUNT = 36;
const LEAGUE_MATCH_TOTAL = 144;
const LEAGUE_MATCHDAY_COUNT = 8;
const BULK_BATCH_SIZE = 18;
const KNOCKOUT_TIE_TOTAL = 23;

export type SimulationRound = (typeof KNOCKOUT_ROUNDS)[number];

export interface SimulationUser {
  readonly uid: string;
  readonly email: string;
  readonly gamerTag: string;
}

export interface SimulationSlotRef {
  readonly type: string;
  readonly seed: number | null;
  readonly tieId: string | null;
}

export interface SimulationSlot {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly position: number | null;
  /** The structural source of the slot: a league seed or a feeding tie. */
  readonly ref: SimulationSlotRef;
  /** Placeholder label before the slot resolves, e.g. "Winner of P4". */
  readonly source: string;
}

export interface SimulationTie {
  readonly tieId: string;
  readonly round: SimulationRound;
  readonly bracketSlot: number;
  readonly legs: 1 | 2;
  readonly group: string | null;
  readonly higher: SimulationSlot;
  readonly lower: SimulationSlot;
  readonly status: string;
  readonly winnerUid: string | null;
  readonly legsPlayed: number;
}

export interface SimulationDecider {
  readonly tieId: string;
  readonly round: SimulationRound;
  readonly method: "extra_time" | "penalties";
  readonly winnerUid: string;
}

export interface SimulationRoundSummary {
  readonly round: SimulationRound;
  readonly ties: number;
  readonly matches: number;
  readonly deciders: readonly SimulationDecider[];
}

export interface FullTournamentSummary {
  readonly tournamentId: string;
  readonly slug: string;
  readonly playerCount: number;
  readonly leagueMatches: number;
  readonly leagueResults: number;
  readonly legs: 1 | 2;
  readonly seed: string;
  readonly bracketHash: string;
  readonly championUid: string;
  readonly championTag: string;
  readonly runnerUpUid: string;
  readonly runnerUpTag: string;
  readonly rounds: readonly SimulationRoundSummary[];
  readonly knockoutMatches: number;
  readonly standingsFrozen: boolean;
  readonly durationMs: number;
}

export interface FullTournamentOptions {
  readonly tournamentId?: string;
  readonly slug?: string;
  readonly name?: string;
  readonly seed?: number;
  /** Legs used for every round before the final. The final is always one. */
  readonly legs?: 1 | 2;
  readonly setSession: (cookie: string) => void;
  readonly log?: (line: string) => void;
}

export interface RouteResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

type RouteHandler = (
  request: NextRequest,
  context: { readonly params: Promise<Record<string, string>> },
) => Promise<Response>;

function playerUid(index: number): string {
  return `player-${String(index).padStart(2, "0")}`;
}

export function playerTag(index: number): string {
  return `Player${String(index).padStart(2, "0")}`;
}

/** Deterministic mulberry32 generator so a simulation seed always replays. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export async function clearEmulatorData(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  const users = await auth.listUsers(1000);
  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  const tournaments = await firestore.collection(paths.tournaments()).listDocuments();
  for (const tournament of tournaments) {
    await firestore.recursiveDelete(tournament);
  }

  const rankings = await firestore.collection(paths.rankings()).listDocuments();
  for (const game of rankings) {
    await firestore.recursiveDelete(game);
  }

  for (const collection of [
    paths.users(),
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.tournamentSlugs(),
    paths.organiserProfiles(),
    paths.auditLogs(),
    paths.platformSettings(),
    paths.rateLimits(),
    paths.platformStats(),
    paths.hallOfFame(),
  ]) {
    const snapshot = await firestore.collection(collection).get();

    if (!snapshot.empty) {
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }
}

export async function createEmulatorUser(options: {
  readonly email: string;
  readonly role: "user" | "organiser" | "super_admin";
  readonly gamerTag: string;
}): Promise<SimulationUser> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const record = await auth.createUser({
    email: options.email,
    password: PASSWORD,
    displayName: options.gamerTag,
  });

  await auth.setCustomUserClaims(record.uid, { role: options.role });

  const now = new Date();
  const profile = {
    gamerTag: options.gamerTag,
    gamerTagLower: options.gamerTag.toLowerCase(),
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
    community: null,
    favouriteClub: null,
    photoUrl: null,
    avatarUrl: null,
    avatarPublicId: null,
  };

  await Promise.all([
    firestore.doc(paths.user(record.uid)).set({
      fullName: `${options.gamerTag} Player`,
      ...profile,
      email: options.email,
      whatsappE164: null,
      role: options.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc(paths.publicProfile(record.uid)).set({
      ...profile,
      status: "active",
      stats: {
        overall: {
          tournaments: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          titles: 0,
          winRate: 0,
        },
        byGame: {},
      },
    }),
  ]);

  return { uid: record.uid, email: options.email, gamerTag: options.gamerTag };
}

export async function createSessionFor(user: SimulationUser): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!host) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST is not set. Start the Auth emulator first.");
  }

  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: PASSWORD, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Emulator sign-in failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { idToken: string };
  return getFirebaseAdminAuth().createSessionCookie(payload.idToken, {
    expiresIn: 60 * 60 * 1000,
  });
}

export function buildRequest(
  method: "POST" | "PATCH" | "GET",
  path: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function invoke(
  handler: unknown,
  request: NextRequest,
  params: Record<string, string>,
): Promise<RouteResult> {
  const response = await (handler as RouteHandler)(request, {
    params: Promise.resolve(params),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

export async function createSimulationTournament(options: {
  readonly tournamentId: string;
  readonly slug: string;
  readonly name: string;
  readonly ownerUid: string;
  readonly status?: string;
  readonly withPlayers?: boolean;
}): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const startsAt = new Date(now.getTime() + 7 * 86_400_000);

  await firestore.doc(paths.tournament(options.tournamentId)).set({
    ownerUid: options.ownerUid,
    ownerTag: "Simulation Owner",
    organisationName: "GCC Simulation",
    slug: options.slug,
    name: options.name,
    nameLower: options.name.toLowerCase(),
    description: "Emulator-only phase 13 tournament simulation.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Fair play.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: new Date(now.getTime() - 7 * 86_400_000),
    registrationClosesAt: new Date(now.getTime() - 86_400_000),
    startsAt,
    maxParticipants: PLAYER_COUNT,
    registrationCount: PLAYER_COUNT,
    status: options.status ?? "registration_closed",
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug(options.slug)).set({
    tournamentId: options.tournamentId,
    name: options.name,
    createdAt: now,
  });

  if (options.withPlayers === false) {
    return;
  }

  const batch = firestore.batch();

  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    const gamerTag = playerTag(index);

    batch.set(firestore.doc(paths.tournamentRegistration(options.tournamentId, playerUid(index))), {
      tournamentId: options.tournamentId,
      gamerTag,
      gamerTagLower: gamerTag.toLowerCase(),
      country: "KE",
      avatarUrl: null,
      platform: "android",
      status: "registered",
      registeredAt: now,
      withdrawnAt: null,
      removedAt: null,
      removedBy: null,
    });
    batch.set(firestore.doc(paths.publicProfile(playerUid(index))), {
      gamerTag,
      gamerTagLower: gamerTag.toLowerCase(),
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      status: "active",
      stats: {
        overall: {
          tournaments: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          titles: 0,
          winRate: 0,
        },
        byGame: {},
      },
    });
  }

  await batch.commit();
}

/**
 * Seeds 144 league match documents directly. Used by prerequisite tests that
 * need a complete or nearly complete league without replaying 144 route calls.
 * `completedMatches` controls how many rows carry a result.
 */
export async function seedLeagueState(options: {
  readonly tournamentId: string;
  readonly completedMatches?: number;
}): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const completed = options.completedMatches ?? LEAGUE_MATCH_TOTAL;
  const batch = firestore.batch();

  for (let index = 0; index < LEAGUE_MATCH_TOTAL; index += 1) {
    const matchday = Math.floor(index / BULK_BATCH_SIZE) + 1;
    const homeIndex = index % PLAYER_COUNT;
    const awayIndex = (index + matchday * 5 + 1) % PLAYER_COUNT;
    const homeUid = playerUid(homeIndex);
    const awayUid = playerUid(awayIndex === homeIndex ? (awayIndex + 1) % PLAYER_COUNT : awayIndex);
    const hasResult = index < completed;

    batch.set(
      firestore.doc(
        paths.tournamentMatch(
          options.tournamentId,
          `league-md${String(matchday).padStart(2, "0")}-m${String((index % BULK_BATCH_SIZE) + 1).padStart(2, "0")}`,
        ),
      ),
      {
        tournamentId: options.tournamentId,
        stage: "league",
        matchday,
        homeUid,
        awayUid,
        homeTag: playerTag(homeIndex),
        awayTag: playerTag(awayIndex),
        participants: [homeUid, awayUid],
        status: hasResult ? "completed" : "scheduled",
        scheduledAt: now,
        result: hasResult
          ? { homeGoals: 2, awayGoals: 1, enteredBy: "seed", enteredAt: now, editCount: 0 }
          : null,
        updatedAt: now,
      },
    );
  }

  await batch.commit();
}

export async function clearRateLimits(): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.collection(paths.rateLimits()).get();

  if (snapshot.empty) {
    return;
  }

  const batch = firestore.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
}

function shortTieLabel(tieId: string): string {
  const playoff = /^playoff-([a-d])(\d)$/.exec(tieId);

  if (playoff) {
    return `P${(playoff[1] ?? "").toUpperCase()}${playoff[2] ?? ""}`;
  }

  if (tieId === "final-1") {
    return "Final";
  }

  const other = /^(r16|qf|sf)-(\d+)$/.exec(tieId);

  if (other) {
    return `${other[1] === "r16" ? "R16" : (other[1] ?? "").toUpperCase()} ${other[2] ?? ""}`;
  }

  return tieId;
}

function readSlot(value: unknown): SimulationSlot {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const ref =
    typeof data.ref === "object" && data.ref !== null ? (data.ref as Record<string, unknown>) : {};

  return {
    uid: typeof data.uid === "string" && data.uid.length > 0 ? data.uid : null,
    gamerTag: typeof data.gamerTag === "string" && data.gamerTag.length > 0 ? data.gamerTag : null,
    position: typeof data.position === "number" ? data.position : null,
    ref: {
      type: typeof ref.type === "string" ? ref.type : "unknown",
      seed: typeof ref.seed === "number" ? ref.seed : null,
      tieId: typeof ref.tieId === "string" ? ref.tieId : null,
    },
    source:
      ref.type === "seed" && typeof ref.seed === "number"
        ? `Seed ${ref.seed}`
        : ref.type === "winnerOf" && typeof ref.tieId === "string"
          ? `Winner of ${shortTieLabel(ref.tieId)}`
          : "To be decided",
  };
}

function toSimulationTie(id: string, data: Record<string, unknown>): SimulationTie {
  return {
    tieId: typeof data.tieId === "string" ? data.tieId : id,
    round: data.round as SimulationRound,
    bracketSlot: typeof data.bracketSlot === "number" ? data.bracketSlot : 0,
    legs: data.legs === 1 ? 1 : 2,
    group: typeof data.group === "string" ? data.group : null,
    higher: readSlot(data.higher),
    lower: readSlot(data.lower),
    status: typeof data.status === "string" ? data.status : "pending",
    winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : null,
    legsPlayed: typeof data.legsPlayed === "number" ? data.legsPlayed : 0,
  };
}

export async function readKnockoutTies(tournamentId: string): Promise<SimulationTie[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournamentKnockoutTies(tournamentId))
    .get();

  return snapshot.docs
    .map((document) => toSimulationTie(document.id, document.data()))
    .sort((a, b) => {
      const roundDelta = KNOCKOUT_ROUNDS.indexOf(a.round) - KNOCKOUT_ROUNDS.indexOf(b.round);
      return roundDelta !== 0 ? roundDelta : a.bracketSlot - b.bracketSlot;
    });
}

export async function readRoundTies(
  tournamentId: string,
  round: SimulationRound,
): Promise<SimulationTie[]> {
  return (await readKnockoutTies(tournamentId)).filter((tie) => tie.round === round);
}

export async function readTie(tournamentId: string, tieId: string): Promise<SimulationTie> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentKnockoutTie(tournamentId, tieId))
    .get();

  if (!snapshot.exists) {
    throw new Error(`Knockout tie ${tieId} was not found.`);
  }

  return toSimulationTie(tieId, snapshot.data() ?? {});
}

export async function readTieMatches(
  tournamentId: string,
  tieId: string,
): Promise<{ readonly id: string; readonly leg: number; readonly status: string }[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournamentMatches(tournamentId))
    .where("tieId", "==", tieId)
    .get();

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      leg: typeof document.data().leg === "number" ? (document.data().leg as number) : 1,
      status: typeof document.data().status === "string" ? (document.data().status as string) : "",
    }))
    .sort((a, b) => a.leg - b.leg);
}

/** Takes the single knockout generation action through the real route. */
export async function generateKnockout(
  tournamentId: string,
  legs: 1 | 2 = 2,
): Promise<RouteResult> {
  const generateRoute =
    await import("@/app/api/organiser/tournaments/[id]/knockout/generate/route");

  return invoke(
    generateRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/knockout/generate`, {
      legs,
    }),
    { id: tournamentId },
  );
}

/** Resets an unplayed bracket through the real route. */
export async function resetKnockout(
  tournamentId: string,
  reason = "Resetting the emulator bracket",
): Promise<RouteResult> {
  const resetRoute = await import("@/app/api/organiser/tournaments/[id]/knockout/reset/route");

  return invoke(
    resetRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/knockout/reset`, {
      reason,
    }),
    { id: tournamentId },
  );
}

export async function enterKnockoutResult(
  tournamentId: string,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<RouteResult> {
  const enterRoute = await import("@/app/api/organiser/tournaments/[id]/results/enter/route");

  return invoke(
    enterRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/results/enter`, {
      matchId,
      homeGoals,
      awayGoals,
    }),
    { id: tournamentId },
  );
}

export async function correctKnockoutResult(
  tournamentId: string,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  reason = "Correcting the recorded knockout score",
): Promise<RouteResult> {
  const correctRoute = await import("@/app/api/organiser/tournaments/[id]/results/correct/route");

  return invoke(
    correctRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/results/correct`, {
      matchId,
      homeGoals,
      awayGoals,
      reason,
    }),
    { id: tournamentId },
  );
}

export async function clearKnockoutResult(
  tournamentId: string,
  matchId: string,
  reason = "Clearing the recorded knockout score",
): Promise<RouteResult> {
  const clearRoute = await import("@/app/api/organiser/tournaments/[id]/results/clear/route");

  return invoke(
    clearRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/results/clear`, {
      matchId,
      reason,
    }),
    { id: tournamentId },
  );
}

export async function decideKnockoutTie(
  tournamentId: string,
  tieId: string,
  body: {
    readonly winnerUid: string;
    readonly method: "extra_time" | "penalties";
    readonly note?: string;
    readonly penalties?: { readonly higher: number; readonly lower: number };
  },
): Promise<RouteResult> {
  const decideRoute =
    await import("@/app/api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide/route");

  return invoke(
    decideRoute.POST,
    buildRequest(
      "POST",
      `/api/organiser/tournaments/${tournamentId}/knockout/ties/${tieId}/decide`,
      body,
    ),
    { id: tournamentId, tieId },
  );
}

function betterPlayer(tie: SimulationTie): SimulationSlot {
  const higher = tie.higher;
  const lower = tie.lower;

  if (!higher.uid || !lower.uid) {
    throw new Error(`Tie ${tie.tieId} is missing a participant.`);
  }

  return (higher.position ?? Number.MAX_SAFE_INTEGER) <= (lower.position ?? Number.MAX_SAFE_INTEGER)
    ? higher
    : lower;
}

/**
 * Plays every leg of one round, records a decider when a tie is level and
 * returns the deciders it recorded. `forcePenaltyTie` makes the tie in that
 * bracket slot level on aggregate so the penalties path is always exercised.
 * Later rounds are created automatically by the previous round's results.
 */
export async function playKnockoutRound(options: {
  readonly tournamentId: string;
  readonly round: SimulationRound;
  readonly random: () => number;
  readonly forcePenaltyTie?: number;
}): Promise<{
  readonly ties: number;
  readonly matches: number;
  readonly deciders: SimulationDecider[];
}> {
  await clearRateLimits();
  const ties = await readRoundTies(options.tournamentId, options.round);
  const expected = KNOCKOUT_ROUND_TIE_COUNTS[options.round];
  const deciders: SimulationDecider[] = [];
  let matches = 0;

  if (ties.length !== expected) {
    throw new Error(`Expected ${expected} ${options.round} ties, found ${ties.length}.`);
  }

  for (const tie of ties) {
    if (!tie.higher.uid || !tie.lower.uid) {
      throw new Error(`Tie ${tie.tieId} has an unresolved participant.`);
    }

    const legMatches = await readTieMatches(options.tournamentId, tie.tieId);

    if (legMatches.length !== tie.legs) {
      throw new Error(
        `Tie ${tie.tieId} should have ${tie.legs} match document(s), found ${legMatches.length}.`,
      );
    }

    const level = options.forcePenaltyTie === tie.bracketSlot;

    for (const match of legMatches) {
      const homeGoals = level ? 0 : Math.floor(options.random() * 4);
      const awayGoals = level ? 0 : Math.floor(options.random() * 4);
      const entered = await enterKnockoutResult(
        options.tournamentId,
        match.id,
        homeGoals,
        awayGoals,
      );

      if (entered.status !== 200) {
        throw new Error(
          `Entering ${match.id} failed (${entered.status}): ${String(entered.body.error ?? "")}`,
        );
      }

      matches += 1;
    }

    const stored = await readTie(options.tournamentId, tie.tieId);

    if (stored.status === "needs_decider") {
      const winner = betterPlayer(stored);
      const method = level ? "penalties" : "extra_time";
      const decided = await decideKnockoutTie(options.tournamentId, tie.tieId, {
        winnerUid: winner.uid as string,
        method,
        note: level
          ? "Level after every leg; decided on penalties."
          : "Level after every leg; decided in extra time.",
        ...(level ? { penalties: { higher: 4, lower: 3 } } : {}),
      });

      if (decided.status !== 200) {
        throw new Error(
          `Deciding ${tie.tieId} failed (${decided.status}): ${String(decided.body.error ?? "")}`,
        );
      }

      deciders.push({
        tieId: tie.tieId,
        round: options.round,
        method,
        winnerUid: winner.uid as string,
      });
    }
  }

  const completed = await readRoundTies(options.tournamentId, options.round);

  if (completed.some((tie) => tie.status !== "completed" || !tie.winnerUid)) {
    throw new Error(`Not every ${options.round} tie has a winner.`);
  }

  return { ties: ties.length, matches, deciders };
}

function standingsFingerprint(
  documents: readonly { readonly id: string; readonly data: () => Record<string, unknown> }[],
): string {
  return documents
    .map((document) => {
      const data = document.data();
      return [
        document.id,
        data.position,
        data.played,
        data.won,
        data.drawn,
        data.lost,
        data.goalsFor,
        data.goalsAgainst,
        data.goalDifference,
        data.points,
        data.provisional,
        data.band,
      ].join(":");
    })
    .sort()
    .join("|");
}

/**
 * Runs the league phase: shuffle and confirm the draw, publish fixtures and
 * enter every league result in bulk. The table is frozen later by the single
 * knockout generation action, not here.
 */
export async function runLeaguePhase(options: {
  readonly tournamentId: string;
  readonly random: () => number;
  readonly log?: (line: string) => void;
}): Promise<{ readonly leagueMatches: number }> {
  const log = options.log ?? (() => undefined);
  const tournamentId = options.tournamentId;

  const [shuffleRoute, confirmRoute, generateRoute, publishFixturesRoute, bulkRoute] =
    await Promise.all([
      import("@/app/api/organiser/tournaments/[id]/draw/shuffle/route"),
      import("@/app/api/organiser/tournaments/[id]/draw/confirm/route"),
      import("@/app/api/organiser/tournaments/[id]/fixtures/generate/route"),
      import("@/app/api/organiser/tournaments/[id]/fixtures/publish/route"),
      import("@/app/api/organiser/tournaments/[id]/results/bulk/route"),
    ]);
  const base = `/api/organiser/tournaments/${tournamentId}`;

  for (const [label, handler, path, body] of [
    ["shuffle draw", shuffleRoute.POST, `${base}/draw/shuffle`, {}],
    ["confirm draw", confirmRoute.POST, `${base}/draw/confirm`, undefined],
    ["generate fixtures", generateRoute.POST, `${base}/fixtures/generate`, {}],
    ["publish fixtures", publishFixturesRoute.POST, `${base}/fixtures/publish`, {}],
  ] as const) {
    const result = await invoke(handler, buildRequest("POST", path, body), { id: tournamentId });

    if (result.status !== 200) {
      throw new Error(`${label} failed (${result.status}): ${String(result.body.error ?? "")}`);
    }

    log(`Completed: ${label}.`);
  }

  const firestore = getFirebaseAdminFirestore();
  const matchesSnapshot = await firestore.collection(paths.tournamentMatches(tournamentId)).get();
  const leagueMatches = matchesSnapshot.docs
    .filter((document) => document.data().stage === "league")
    .sort((a, b) => {
      const left = a.data();
      const right = b.data();
      const matchday = Number(left.matchday ?? 0) - Number(right.matchday ?? 0);
      return matchday !== 0 ? matchday : a.id.localeCompare(b.id);
    });

  if (leagueMatches.length !== LEAGUE_MATCH_TOTAL) {
    throw new Error(
      `Expected ${LEAGUE_MATCH_TOTAL} league matches, found ${leagueMatches.length}.`,
    );
  }

  const matchdayCount = new Set(leagueMatches.map((document) => document.data().matchday)).size;

  if (matchdayCount !== LEAGUE_MATCHDAY_COUNT) {
    throw new Error(`Expected ${LEAGUE_MATCHDAY_COUNT} matchdays, found ${matchdayCount}.`);
  }

  log("League fixtures published; entering 144 results.");

  for (let offset = 0; offset < leagueMatches.length; offset += BULK_BATCH_SIZE) {
    const batch = leagueMatches.slice(offset, offset + BULK_BATCH_SIZE);

    await clearRateLimits();
    const result = await invoke(
      bulkRoute.POST,
      buildRequest("POST", `${base}/results/bulk`, {
        results: batch.map((document) => ({
          matchId: document.id,
          homeGoals: Math.floor(options.random() * 4),
          awayGoals: Math.floor(options.random() * 4),
        })),
      }),
      { id: tournamentId },
    );

    if (result.status !== 200) {
      throw new Error(
        `Bulk result entry failed (${result.status}): ${String(result.body.error ?? "")}`,
      );
    }
  }

  log("All 144 league results recorded.");

  return { leagueMatches: leagueMatches.length };
}

/**
 * Runs the complete Phase 13C tournament: 36 registrations, a shuffled draw,
 * 144 league results, one bracket generation and every knockout round played
 * until the final completes the tournament automatically.
 */
export async function runFullTournamentSimulation(
  options: FullTournamentOptions,
): Promise<FullTournamentSummary> {
  const startedAt = Date.now();
  const log = options.log ?? (() => undefined);
  const tournamentId = options.tournamentId ?? "simulation-cup";
  const slug = options.slug ?? "simulation-cup";
  const name = options.name ?? "Simulation Cup";
  const random = createRandom(options.seed ?? 20261313);
  const legs = options.legs ?? 2;

  const owner = await createEmulatorUser({
    email: `${slug}-owner@example.com`,
    role: "organiser",
    gamerTag: "SimulationOwner",
  });
  options.setSession(await createSessionFor(owner));
  await createSimulationTournament({ tournamentId, slug, name, ownerUid: owner.uid });
  log(`Created ${name} with ${PLAYER_COUNT} registered players.`);

  const league = await runLeaguePhase({ tournamentId, random, log });

  await clearRateLimits();
  const generated = await generateKnockout(tournamentId, legs);

  if (generated.status !== 200) {
    throw new Error(
      `Generating the knockout stage failed (${generated.status}): ${String(generated.body.error ?? "")}`,
    );
  }

  const seed = String(generated.body.seed ?? "");
  const firestore = getFirebaseAdminFirestore();
  const standingsAfterGenerate = await firestore
    .collection(paths.tournamentStandings(tournamentId))
    .get();
  const frozenFingerprint = standingsFingerprint(standingsAfterGenerate.docs);

  if (standingsAfterGenerate.docs.some((document) => document.data().provisional !== false)) {
    throw new Error("Generating the bracket left a provisional standings row.");
  }
  log("Knockout stage generated and the league table frozen.");

  const rounds: SimulationRoundSummary[] = [];

  for (const round of KNOCKOUT_ROUNDS) {
    await clearRateLimits();
    const played = await playKnockoutRound({
      tournamentId,
      round,
      random,
      forcePenaltyTie: round === "playoff" ? 1 : undefined,
    });

    rounds.push({
      round,
      ties: played.ties,
      matches: played.matches,
      deciders: played.deciders,
    });
    log(
      `Completed ${round}: ${played.ties} tie${played.ties === 1 ? "" : "s"}, ${played.matches} match${played.matches === 1 ? "" : "es"}${
        played.deciders.length > 0
          ? `, ${played.deciders.length} decider${played.deciders.length === 1 ? "" : "s"}`
          : ""
      }.`,
    );
  }

  const tournamentSnapshot = await firestore.doc(paths.tournament(tournamentId)).get();
  const tournament = tournamentSnapshot.data() ?? {};
  const championUid = String(tournament.championUid ?? "");
  const runnerUpUid = String(tournament.runnerUpUid ?? "");
  const registrationSnapshot = await firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .get();
  const tags = new Map(
    registrationSnapshot.docs.map((document) => [
      document.id,
      String(document.data().gamerTag ?? document.id),
    ]),
  );
  const standingsAfter = await firestore.collection(paths.tournamentStandings(tournamentId)).get();
  const standingsFrozen = standingsFingerprint(standingsAfter.docs) === frozenFingerprint;
  const knockoutMatches = rounds.reduce((total, round) => total + round.matches, 0);
  const ties = await readKnockoutTies(tournamentId);

  if (ties.length !== KNOCKOUT_TIE_TOTAL) {
    throw new Error(`Expected ${KNOCKOUT_TIE_TOTAL} knockout ties, found ${ties.length}.`);
  }

  if (!championUid || !runnerUpUid || tournament.status !== "completed") {
    throw new Error("The tournament did not finish with a champion and runner-up.");
  }

  return {
    tournamentId,
    slug,
    playerCount: registrationSnapshot.size,
    leagueMatches: league.leagueMatches,
    leagueResults: league.leagueMatches,
    legs,
    seed,
    bracketHash: String(tournament.knockoutBracketHash ?? ""),
    championUid,
    championTag: tags.get(championUid) ?? championUid,
    runnerUpUid,
    runnerUpTag: tags.get(runnerUpUid) ?? runnerUpUid,
    rounds,
    knockoutMatches,
    standingsFrozen,
    durationMs: Date.now() - startedAt,
  };
}
