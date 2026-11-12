// GCC - emulator-backed integration tests for Phase 10 fixtures.
//
// These run the real Admin SDK, the real fixture module and the real route
// guards against the Auth and Firestore emulators. They prove generation needs
// a confirmed draw, publication writes exactly 144 matches / 8 matchdays / 36
// standings, a concurrent double publish produces one set, tampering fails
// verification, reset is blocked once a result exists, and a non-owner gets the
// same 404 as a missing tournament.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionCookie } = vi.hoisted(() => ({
  sessionCookie: { value: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gcc_session" && sessionCookie.value
        ? { name, value: sessionCookie.value }
        : undefined,
  }),
}));

import { POST as generateRoute } from "@/app/api/organiser/tournaments/[id]/fixtures/generate/route";
import { PATCH as matchdayRoute } from "@/app/api/organiser/tournaments/[id]/fixtures/matchdays/[n]/route";
import { POST as publishRoute } from "@/app/api/organiser/tournaments/[id]/fixtures/publish/route";
import { POST as resetRoute } from "@/app/api/organiser/tournaments/[id]/fixtures/reset/route";
import { GET as verifyRoute } from "@/app/api/organiser/tournaments/[id]/fixtures/verify/route";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { getPublicFixtures } from "@/lib/data/public-fixtures";

const PASSWORD = "correct horse battery";
const TOURNAMENT_ID = "fixture-cup";
const MATCH_COUNT = 144;
const MATCHDAY_COUNT = 8;
const PLAYER_COUNT = 36;

interface SeededUser {
  readonly uid: string;
  readonly email: string;
}

let owner: SeededUser;
let otherOrganiser: SeededUser;
let plainPlayer: SeededUser;

function playerUid(index: number): string {
  return `player-${String(index).padStart(2, "0")}`;
}

async function clearEmulator(): Promise<void> {
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

async function createUser(options: {
  readonly email: string;
  readonly role: "user" | "organiser" | "super_admin";
  readonly gamerTag: string;
}): Promise<SeededUser> {
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

  return { uid: record.uid, email: options.email };
}

async function signInIdToken(email: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Emulator sign-in failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { idToken: string };
  return payload.idToken;
}

async function sessionFor(user: SeededUser): Promise<string> {
  const idToken = await signInIdToken(user.email);
  return getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: 60 * 60 * 1000 });
}

function request(method: "POST" | "PATCH" | "GET", path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(n = "1"): { params: Promise<{ id: string; n: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID, n }) };
}

async function createTournament(status = "pots_confirmed"): Promise<void> {
  const now = new Date();
  const firestore = getFirebaseAdminFirestore();

  await firestore.doc(paths.tournament(TOURNAMENT_ID)).set({
    ownerUid: owner.uid,
    ownerTag: "Organiser",
    organisationName: "Fixture Org",
    slug: "fixture-cup",
    name: "Fixture Cup",
    nameLower: "fixture cup",
    description: "Fixture integration test.",
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
    startsAt: new Date(now.getTime() + 7 * 86_400_000),
    maxParticipants: 36,
    registrationCount: PLAYER_COUNT,
    status,
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug("fixture-cup")).set({
    tournamentId: TOURNAMENT_ID,
    name: "Fixture Cup",
    createdAt: now,
  });
}

async function seedRegistrations(): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const batch = firestore.batch();
  const now = new Date();

  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    batch.set(firestore.doc(paths.tournamentRegistration(TOURNAMENT_ID, playerUid(index))), {
      tournamentId: TOURNAMENT_ID,
      gamerTag: `Player${String(index).padStart(2, "0")}`,
      gamerTagLower: `player${String(index).padStart(2, "0")}`,
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

async function seedConfirmedDraw(): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const ids = Array.from({ length: PLAYER_COUNT }, (_, index) => playerUid(index));
  const pots = {
    "1": ids.slice(0, 9),
    "2": ids.slice(9, 18),
    "3": ids.slice(18, 27),
    "4": ids.slice(27, 36),
  };

  await firestore.doc(paths.tournamentDrawCurrent(TOURNAMENT_ID)).set({
    status: "confirmed",
    pots,
    unassigned: [],
    method: "manual",
    shuffleSeed: "a".repeat(64),
    algorithmVersion: 1,
    locks: {},
    playersSnapshot: Object.fromEntries(
      ids.map((uid, index) => [
        uid,
        {
          gamerTag: `Player${String(index).padStart(2, "0")}`,
          avatarUrl: null,
          country: "KE",
        },
      ]),
    ),
    tiebreakSeed: "b".repeat(64),
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    confirmedBy: owner.uid,
  });
}

async function readTournament(): Promise<Record<string, unknown>> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(TOURNAMENT_ID)).get();
  return snapshot.data() ?? {};
}

async function collectionSize(path: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore().collection(path).get();
  return snapshot.size;
}

async function auditCount(action: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.auditLogs())
    .where("action", "==", action)
    .where("tournamentId", "==", TOURNAMENT_ID)
    .get();

  return snapshot.size;
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function generate(): Promise<Response> {
  return generateRoute(
    request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/generate`, {}),
    context(),
  );
}

async function publish(windows?: unknown): Promise<Response> {
  return publishRoute(
    request(
      "POST",
      `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/publish`,
      windows === undefined ? {} : { windows },
    ),
    context(),
  );
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();

  owner = await createUser({
    email: "fixture-owner@example.com",
    role: "organiser",
    gamerTag: "FixtureOwner",
  });
  otherOrganiser = await createUser({
    email: "fixture-other@example.com",
    role: "organiser",
    gamerTag: "OtherOrganiser",
  });
  plainPlayer = await createUser({
    email: "fixture-player@example.com",
    role: "user",
    gamerTag: "PlainPlayer",
  });

  await createTournament();
  await seedRegistrations();
  sessionCookie.value = await sessionFor(owner);
});

afterAll(async () => {
  await clearEmulator();
});

describe("fixture generation", () => {
  it("refuses to generate without a confirmed draw", async () => {
    const response = await generate();

    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("draw");
  });

  it("generates a validated private draft with a server seed and a canonical hash", async () => {
    await seedConfirmedDraw();

    const response = await generate();
    expect(response.status).toBe(200);

    const body = await bodyOf(response);
    expect(String(body.seed)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(body.scheduleHash)).toMatch(/^[0-9a-f]{64}$/);

    const draftSnapshot = await getFirebaseAdminFirestore()
      .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
      .get();
    const draft = draftSnapshot.data() ?? {};

    expect((draft.fixtures as unknown[]).length).toBe(MATCH_COUNT);
    expect(draft.generationCount).toBe(1);
    expect(draft.algorithmVersion).toBe(1);
    expect((draft.validation as { valid: boolean }).valid).toBe(true);

    const fixtures = draft.fixtures as { matchday: number }[];
    const perMatchday = Array.from({ length: MATCHDAY_COUNT }, (_, index) => index + 1).map(
      (day) => fixtures.filter((fixture) => fixture.matchday === day).length,
    );
    expect(perMatchday).toEqual(new Array<number>(MATCHDAY_COUNT).fill(18));

    // The draft is private: no matches or matchdays exist yet.
    expect(await collectionSize(paths.tournamentMatches(TOURNAMENT_ID))).toBe(0);
    expect(await collectionSize(paths.tournamentMatchdays(TOURNAMENT_ID))).toBe(0);
    expect(await auditCount("tournament.fixtures.generated")).toBe(1);
  });

  it("overwrites a previous draft while still at pots confirmed", async () => {
    await seedConfirmedDraw();
    expect((await generate()).status).toBe(200);
    const firstHash = (
      await getFirebaseAdminFirestore()
        .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
        .get()
    ).data()?.scheduleHash;

    expect((await generate()).status).toBe(200);
    const second =
      (
        await getFirebaseAdminFirestore()
          .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
          .get()
      ).data() ?? {};

    expect(second.generationCount).toBe(2);
    expect(typeof second.scheduleHash).toBe("string");
    expect(second.scheduleHash).not.toBe(firstHash);
  });
});

describe("fixture publication", () => {
  it("writes exactly 144 matches, 8 matchdays and 36 zeroed standings", async () => {
    await seedConfirmedDraw();
    await generate();

    const response = await publish();
    expect(response.status).toBe(200);

    const tournament = await readTournament();
    expect(tournament.status).toBe("fixtures_published");
    expect(String(tournament.scheduleHash)).toMatch(/^[0-9a-f]{64}$/);
    expect(tournament.leagueMatchesCompleted).toBe(0);

    expect(await collectionSize(paths.tournamentMatches(TOURNAMENT_ID))).toBe(MATCH_COUNT);
    expect(await collectionSize(paths.tournamentMatchdays(TOURNAMENT_ID))).toBe(MATCHDAY_COUNT);
    expect(await collectionSize(paths.tournamentStandings(TOURNAMENT_ID))).toBe(PLAYER_COUNT);

    const standings = await getFirebaseAdminFirestore()
      .collection(paths.tournamentStandings(TOURNAMENT_ID))
      .limit(1)
      .get();
    const standing = standings.docs[0]?.data() ?? {};
    expect(standing).toMatchObject({ MP: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 });

    const firstMatch = await getFirebaseAdminFirestore()
      .doc(paths.tournamentMatch(TOURNAMENT_ID, "league-md01-m01"))
      .get();
    expect(firstMatch.exists).toBe(true);
    expect(firstMatch.data()?.stage).toBe("league");
    expect(firstMatch.data()?.status).toBe("scheduled");
    expect(firstMatch.data()?.participants).toHaveLength(2);

    expect(await auditCount("tournament.fixtures.published")).toBe(1);
  });

  it("accepts eight explicit windows and exposes them on matchday documents", async () => {
    await seedConfirmedDraw();
    await generate();

    const windows = Array.from({ length: MATCHDAY_COUNT }, (_, index) => ({
      number: index + 1,
      startsOn: new Date(Date.UTC(2026, 0, 1 + index * 7)).toISOString(),
      endsOn: new Date(Date.UTC(2026, 0, 6 + index * 7)).toISOString(),
    }));

    const response = await publish(windows);
    expect(response.status).toBe(200);

    const matchday = await getFirebaseAdminFirestore()
      .doc(paths.tournamentMatchday(TOURNAMENT_ID, 1))
      .get();
    expect(matchday.exists).toBe(true);
    expect((matchday.data()?.startsOn as { toDate: () => Date }).toDate().toISOString()).toBe(
      windows[0]?.startsOn,
    );

    const patch = await matchdayRoute(
      request("PATCH", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/matchdays/1`, {
        startsOn: "2026-02-01T12:00:00.000Z",
        endsOn: "2026-02-07T12:00:00.000Z",
      }),
      context("1"),
    );
    expect(patch.status).toBe(200);

    const updated = await getFirebaseAdminFirestore()
      .doc(paths.tournamentMatchday(TOURNAMENT_ID, 1))
      .get();
    expect((updated.data()?.startsOn as { toDate: () => Date }).toDate().toISOString()).toBe(
      "2026-02-01T12:00:00.000Z",
    );
    expect(await auditCount("tournament.matchday.window_updated")).toBe(1);
  });

  it("allows exactly one of two concurrent publications", async () => {
    await seedConfirmedDraw();
    await generate();

    const [first, second] = await Promise.all([publish(), publish()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    expect(await collectionSize(paths.tournamentMatches(TOURNAMENT_ID))).toBe(MATCH_COUNT);
    expect(await collectionSize(paths.tournamentMatchdays(TOURNAMENT_ID))).toBe(MATCHDAY_COUNT);
    expect(await collectionSize(paths.tournamentStandings(TOURNAMENT_ID))).toBe(PLAYER_COUNT);
    expect(await auditCount("tournament.fixtures.published")).toBe(1);
  });
});

describe("fixture integrity", () => {
  it("verifies the published schedule and fails after a match is tampered with", async () => {
    await seedConfirmedDraw();
    await generate();
    await publish();

    const clean = await verifyRoute(
      request("GET", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/verify`),
      context(),
    );
    expect(clean.status).toBe(200);
    expect((await bodyOf(clean)).valid).toBe(true);

    // Tamper with one match: the validator and the hash must both notice.
    const matches = await getFirebaseAdminFirestore()
      .collection(paths.tournamentMatches(TOURNAMENT_ID))
      .limit(1)
      .get();
    const match = matches.docs[0];

    await match.ref.update({ homeUid: playerUid(1) });

    const tampered = await verifyRoute(
      request("GET", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/verify`),
      context(),
    );
    expect(tampered.status).toBe(200);

    const body = await bodyOf(tampered);
    expect(body.valid).toBe(false);
    expect((body.issues as unknown[]).length).toBeGreaterThan(0);
    expect(body.hash).not.toBe(body.storedHash);
  });

  it("reports no fixtures honestly before publication", async () => {
    await seedConfirmedDraw();
    await generate();

    const response = await verifyRoute(
      request("GET", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/verify`),
      context(),
    );

    expect(response.status).toBe(200);
    const body = await bodyOf(response);
    expect(body.valid).toBe(false);
    expect((body.issues as { code: string }[]).some((issue) => issue.code === "no-fixtures")).toBe(
      true,
    );
  });
});

describe("fixture reset", () => {
  it("deletes the published schedule before any result and keeps the draft", async () => {
    await seedConfirmedDraw();
    await generate();
    await publish();

    const draftBefore = await getFirebaseAdminFirestore()
      .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
      .get();
    expect(draftBefore.exists).toBe(true);

    const response = await resetRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/reset`, {
        reason: "Competition dates changed.",
      }),
      context(),
    );
    expect(response.status).toBe(200);

    const tournament = await readTournament();
    expect(tournament.status).toBe("pots_confirmed");
    expect(tournament.scheduleHash).toBeNull();
    expect(await collectionSize(paths.tournamentMatches(TOURNAMENT_ID))).toBe(0);
    expect(await collectionSize(paths.tournamentMatchdays(TOURNAMENT_ID))).toBe(0);
    expect(await collectionSize(paths.tournamentStandings(TOURNAMENT_ID))).toBe(0);

    expect(
      (
        await getFirebaseAdminFirestore()
          .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
          .get()
      ).exists,
    ).toBe(true);
    expect(await auditCount("tournament.fixtures.reset")).toBe(1);
  });

  it("refuses a reset once a result exists", async () => {
    await seedConfirmedDraw();
    await generate();
    await publish();

    const matches = await getFirebaseAdminFirestore()
      .collection(paths.tournamentMatches(TOURNAMENT_ID))
      .limit(1)
      .get();
    await matches.docs[0]?.ref.update({
      status: "completed",
      result: { homeGoals: 2, awayGoals: 1, recordedBy: owner.uid },
    });

    const response = await resetRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/fixtures/reset`, {}),
      context(),
    );
    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("result");

    expect(await collectionSize(paths.tournamentMatches(TOURNAMENT_ID))).toBe(MATCH_COUNT);
  });
});

describe("fixture visibility and access", () => {
  it("returns public fixtures only after publication", async () => {
    await seedConfirmedDraw();

    expect(await getPublicFixtures(TOURNAMENT_ID, "pots_confirmed")).toBeNull();

    await generate();
    expect(await getPublicFixtures(TOURNAMENT_ID, "pots_confirmed")).toBeNull();

    await publish();
    const published = await getPublicFixtures(TOURNAMENT_ID, "fixtures_published");

    expect(published).not.toBeNull();
    expect(published?.matches).toHaveLength(MATCH_COUNT);
    expect(published?.matchdays).toHaveLength(MATCHDAY_COUNT);
  });

  it("hides generation from another organiser and a plain player", async () => {
    await seedConfirmedDraw();

    sessionCookie.value = await sessionFor(otherOrganiser);
    const other = await generate();
    expect(other.status).toBe(404);

    sessionCookie.value = await sessionFor(plainPlayer);
    const plain = await generate();
    expect(plain.status).toBe(403);
  });
});
