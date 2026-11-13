// GCC - shared full-tournament simulator for Phase 13.
//
// It drives the real route handlers against the Firebase emulators: shuffles and
// confirms the draw, generates and publishes the 144 league fixtures, records
// every league result in bulk, closes the league, then draws, publishes and
// plays every knockout round (including any decider) before completing the
// tournament. The knockout integration test uses it as its end-to-end case and
// `npm run simulate` uses the same runner to print a readable summary.
//
// The caller must mock `next/headers` (session cookie) before importing this
// module. Route handlers are imported dynamically so that mock is in place.
import { NextRequest } from "next/server";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

const PASSWORD = "correct horse battery";
const PLAYER_COUNT = 36;
const LEAGUE_MATCH_TOTAL = 144;
const LEAGUE_MATCHDAY_COUNT = 8;
const BULK_BATCH_SIZE = 18;
const KNOCKOUT_ROUNDS = ["playoff", "r16", "qf", "sf", "final"] as const;
const KNOCKOUT_TIE_COUNTS: Readonly<Record<string, number>> = {
  playoff: 8,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
};

export type SimulationRound = (typeof KNOCKOUT_ROUNDS)[number];

export interface SimulationUser {
  readonly uid: string;
  readonly email: string;
  readonly gamerTag: string;
}

export interface SimulationTie {
  readonly tieId: string;
  readonly round: SimulationRound;
  readonly bracketSlot: number;
  readonly legs: number;
  readonly higherSeedUid: string;
  readonly lowerSeedUid: string;
  readonly higherSeedPosition: number;
  readonly lowerSeedPosition: number;
  readonly group: string | null;
  readonly status: string;
  readonly winnerUid: string | null;
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
    batch.set(firestore.doc(paths.tournamentRegistration(options.tournamentId, playerUid(index))), {
      tournamentId: options.tournamentId,
      gamerTag: playerTag(index),
      gamerTagLower: playerTag(index).toLowerCase(),
      country: "KE",
      avatarUrl: null,
      platform: "android",
      status: "registered",
      registeredAt: now,
      withdrawnAt: null,
      removedAt: null,
      removedBy: null,
    });
  }

  await batch.commit();
}

/**
 * Seeds a league table and 144 match documents directly. Used by prerequisite
 * tests that need a closed or nearly closed league without replaying 144 route
 * calls. `completedMatches` controls how many rows carry a result.
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

  const bands = (position: number) =>
    position <= 8
      ? "direct"
      : position <= 16
        ? "playoff_seeded"
        : position <= 24
          ? "playoff_unseeded"
          : "eliminated";

  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    const position = index + 1;

    batch.set(firestore.doc(paths.tournamentStanding(options.tournamentId, playerUid(index))), {
      tournamentId: options.tournamentId,
      gamerTag: playerTag(index),
      avatarUrl: null,
      lot: index + 1,
      played: 8,
      won: Math.max(0, 8 - index),
      drawn: 0,
      lost: Math.min(8, index),
      goalsFor: Math.max(0, 20 - index),
      goalsAgainst: index,
      goalDifference: Math.max(0, 20 - index) - index,
      points: Math.max(0, (8 - index) * 3),
      awayGoals: Math.max(0, 10 - index),
      wins: Math.max(0, 8 - index),
      awayWins: Math.max(0, 4 - Math.floor(index / 2)),
      opponentPoints: 0,
      opponentGoalDifference: 0,
      opponentGoalsFor: 0,
      form: [],
      position,
      separatedBy: null,
      band: bands(position),
      provisional: true,
      updatedAt: now,
    });
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

export async function readRoundTies(
  tournamentId: string,
  round: SimulationRound,
): Promise<SimulationTie[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournamentKnockoutTies(tournamentId))
    .where("round", "==", round)
    .get();

  return snapshot.docs
    .map((document) => {
      const data = document.data() as Record<string, unknown>;

      return {
        tieId: String(data.tieId ?? document.id),
        round: data.round as SimulationRound,
        bracketSlot: typeof data.bracketSlot === "number" ? data.bracketSlot : 0,
        legs: data.legs === 1 ? 1 : 2,
        higherSeedUid: String(data.higherSeedUid ?? ""),
        lowerSeedUid: String(data.lowerSeedUid ?? ""),
        higherSeedPosition:
          typeof data.higherSeedPosition === "number" ? data.higherSeedPosition : 0,
        lowerSeedPosition: typeof data.lowerSeedPosition === "number" ? data.lowerSeedPosition : 0,
        group: typeof data.group === "string" ? data.group : null,
        status: typeof data.status === "string" ? data.status : "pending",
        winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : null,
      } satisfies SimulationTie;
    })
    .sort((a, b) => a.bracketSlot - b.bracketSlot);
}

export async function readTie(tournamentId: string, tieId: string): Promise<SimulationTie> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentKnockoutTie(tournamentId, tieId))
    .get();
  const data = snapshot.data() as Record<string, unknown> | undefined;

  if (!snapshot.exists || !data) {
    throw new Error(`Knockout tie ${tieId} was not found.`);
  }

  return {
    tieId: String(data.tieId ?? tieId),
    round: data.round as SimulationRound,
    bracketSlot: typeof data.bracketSlot === "number" ? data.bracketSlot : 0,
    legs: data.legs === 1 ? 1 : 2,
    higherSeedUid: String(data.higherSeedUid ?? ""),
    lowerSeedUid: String(data.lowerSeedUid ?? ""),
    higherSeedPosition: typeof data.higherSeedPosition === "number" ? data.higherSeedPosition : 0,
    lowerSeedPosition: typeof data.lowerSeedPosition === "number" ? data.lowerSeedPosition : 0,
    group: typeof data.group === "string" ? data.group : null,
    status: typeof data.status === "string" ? data.status : "pending",
    winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : null,
  };
}

/** Draws and immediately publishes one round through the real routes. */
export async function drawAndPublishRound(
  tournamentId: string,
  round: SimulationRound,
): Promise<{ readonly ties: number; readonly matches: number }> {
  const [drawRoute, publishRoute] = await Promise.all([
    import("@/app/api/organiser/tournaments/[id]/knockout/draw/route"),
    import("@/app/api/organiser/tournaments/[id]/knockout/publish/route"),
  ]);
  const path = `/api/organiser/tournaments/${tournamentId}/knockout`;
  const drawn = await invoke(drawRoute.POST, buildRequest("POST", `${path}/draw`, { round }), {
    id: tournamentId,
  });

  if (drawn.status !== 200) {
    throw new Error(
      `Drawing the ${round} failed (${drawn.status}): ${String(drawn.body.error ?? "")}`,
    );
  }

  const published = await invoke(
    publishRoute.POST,
    buildRequest("POST", `${path}/publish`, { round }),
    { id: tournamentId },
  );

  if (published.status !== 200) {
    throw new Error(
      `Publishing the ${round} failed (${published.status}): ${String(published.body.error ?? "")}`,
    );
  }

  return {
    ties: Number(published.body.tieCount ?? 0),
    matches: Number(published.body.matchCount ?? 0),
  };
}

/**
 * Plays every leg of a published round, records a decider when a tie is level
 * and returns the deciders it recorded. `forcePenaltyTie` makes the tie in that
 * bracket slot level on aggregate so the penalties path is always exercised.
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
  const [enterRoute, decideRoute] = await Promise.all([
    import("@/app/api/organiser/tournaments/[id]/results/enter/route"),
    import("@/app/api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide/route"),
  ]);
  const ties = await readRoundTies(options.tournamentId, options.round);
  const deciders: SimulationDecider[] = [];
  let matches = 0;

  if (ties.length !== KNOCKOUT_TIE_COUNTS[options.round]) {
    throw new Error(
      `Expected ${KNOCKOUT_TIE_COUNTS[options.round]} ${options.round} ties, found ${ties.length}.`,
    );
  }

  for (const tie of ties) {
    const level = options.forcePenaltyTie === tie.bracketSlot;
    const legs = tie.legs;

    for (let leg = 1; leg <= legs; leg += 1) {
      const matchId = `${tie.tieId}-l${leg}`;
      const homeGoals = level ? 0 : Math.floor(options.random() * 4);
      const awayGoals = level ? 0 : Math.floor(options.random() * 4);
      const entered = await invoke(
        enterRoute.POST,
        buildRequest("POST", `/api/organiser/tournaments/${options.tournamentId}/results/enter`, {
          matchId,
          homeGoals,
          awayGoals,
        }),
        { id: options.tournamentId },
      );

      if (entered.status !== 200) {
        throw new Error(
          `Entering ${matchId} failed (${entered.status}): ${String(entered.body.error ?? "")}`,
        );
      }

      matches += 1;
    }

    const stored = await readTie(options.tournamentId, tie.tieId);

    if (stored.status === "needs_decider") {
      const method = level ? "penalties" : "extra_time";
      const winnerUid = stored.higherSeedUid;
      const decided = await invoke(
        decideRoute.POST,
        buildRequest(
          "POST",
          `/api/organiser/tournaments/${options.tournamentId}/knockout/ties/${tie.tieId}/decide`,
          {
            winnerUid,
            method,
            note: level
              ? "Level after two legs; decided on penalties."
              : "Level after two legs; decided in extra time.",
            ...(level ? { penalties: { higher: 4, lower: 3 } } : {}),
          },
        ),
        { id: options.tournamentId, tieId: tie.tieId },
      );

      if (decided.status !== 200) {
        throw new Error(
          `Deciding ${tie.tieId} failed (${decided.status}): ${String(decided.body.error ?? "")}`,
        );
      }

      deciders.push({
        tieId: tie.tieId,
        round: options.round,
        method,
        winnerUid,
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
 * Runs the league phase: shuffle and confirm the draw, publish fixtures, enter
 * every league result in bulk and close the table. Returns a fingerprint of the
 * frozen standings so callers can prove knockout results never alter them.
 */
export async function runLeaguePhase(options: {
  readonly tournamentId: string;
  readonly random: () => number;
  readonly log?: (line: string) => void;
}): Promise<{ readonly leagueMatches: number; readonly standingsFingerprint: string }> {
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

  const closeRoute =
    await import("@/app/api/organiser/tournaments/[id]/knockout/close-league/route");
  const closed = await invoke(
    closeRoute.POST,
    buildRequest("POST", `${base}/knockout/close-league`),
    { id: tournamentId },
  );

  if (closed.status !== 200) {
    throw new Error(
      `Closing the league failed (${closed.status}): ${String(closed.body.error ?? "")}`,
    );
  }

  const standingsAfterClose = await firestore
    .collection(paths.tournamentStandings(tournamentId))
    .get();

  if (standingsAfterClose.docs.some((document) => document.data().provisional !== false)) {
    throw new Error("Closing the league left a provisional standings row.");
  }

  log("League phase closed and the table frozen.");

  return {
    leagueMatches: leagueMatches.length,
    standingsFingerprint: standingsFingerprint(standingsAfterClose.docs),
  };
}

/**
 * Runs the complete Phase 13 tournament: 36 registrations, a shuffled draw,
 * 144 league results, a closed league and every knockout round.
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

  const owner = await createEmulatorUser({
    email: `${slug}-owner@example.com`,
    role: "organiser",
    gamerTag: "SimulationOwner",
  });
  options.setSession(await createSessionFor(owner));
  await createSimulationTournament({ tournamentId, slug, name, ownerUid: owner.uid });
  log(`Created ${name} with ${PLAYER_COUNT} registered players.`);

  const league = await runLeaguePhase({ tournamentId, random, log });
  const rounds: SimulationRoundSummary[] = [];

  for (const round of KNOCKOUT_ROUNDS) {
    await clearRateLimits();
    const published = await drawAndPublishRound(tournamentId, round);
    const played = await playKnockoutRound({
      tournamentId,
      round,
      random,
      forcePenaltyTie: round === "playoff" ? 1 : undefined,
    });

    if (published.ties !== played.ties || published.matches !== played.matches) {
      throw new Error(`The published ${round} counts do not match the played counts.`);
    }

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

  const completeRoute =
    await import("@/app/api/organiser/tournaments/[id]/knockout/complete/route");
  const completed = await invoke(
    completeRoute.POST,
    buildRequest("POST", `/api/organiser/tournaments/${tournamentId}/knockout/complete`, {}),
    { id: tournamentId },
  );

  if (completed.status !== 200) {
    throw new Error(
      `Completing the tournament failed (${completed.status}): ${String(completed.body.error ?? "")}`,
    );
  }

  const firestore = getFirebaseAdminFirestore();
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
  const standingsFrozen = standingsFingerprint(standingsAfter.docs) === league.standingsFingerprint;
  const knockoutMatches = rounds.reduce((total, round) => total + round.matches, 0);

  if (!championUid || !runnerUpUid || tournament.status !== "completed") {
    throw new Error("The tournament did not finish with a champion and runner-up.");
  }

  return {
    tournamentId,
    slug,
    playerCount: registrationSnapshot.size,
    leagueMatches: league.leagueMatches,
    leagueResults: league.leagueMatches,
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
