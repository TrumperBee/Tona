// GCC - emulator-backed integration tests for Phase 11 results and reports.
//
// These run the real Admin SDK, the real result/report modules and the real
// route guards against the Auth and Firestore emulators. They prove a result
// updates the match, the completed counter and the tournament status in one
// transaction; a second or concurrent entry is rejected; corrections and
// clears require a reason and are audited; a bulk batch is all-or-nothing;
// non-owners receive the same 404 as a missing tournament; players cannot enter
// results; and result reports are participant-only, one open per player per
// match, resolved by an owner with a note and a notification.
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

import { POST as reportRoute } from "@/app/api/tournaments/[id]/matches/[matchId]/report/route";
import { POST as clearRoute } from "@/app/api/organiser/tournaments/[id]/results/clear/route";
import { POST as correctRoute } from "@/app/api/organiser/tournaments/[id]/results/correct/route";
import { POST as bulkRoute } from "@/app/api/organiser/tournaments/[id]/results/bulk/route";
import { POST as enterRoute } from "@/app/api/organiser/tournaments/[id]/results/enter/route";
import { POST as resolveRoute } from "@/app/api/organiser/tournaments/[id]/result-reports/[reportId]/resolve/route";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

const PASSWORD = "correct horse battery";
const TOURNAMENT_ID = "result-cup";
const MATCH_A = "league-md01-m01";
const MATCH_B = "league-md01-m02";
const MATCH_C = "league-md02-m01";

interface SeededUser {
  readonly uid: string;
  readonly email: string;
  readonly gamerTag: string;
}

let owner: SeededUser;
let otherOrganiser: SeededUser;
let superAdmin: SeededUser;
let plainPlayer: SeededUser;
let playerA: SeededUser;
let playerB: SeededUser;
let playerC: SeededUser;

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

  return { uid: record.uid, email: options.email, gamerTag: options.gamerTag };
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

function request(method: "POST", path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createTournament(status = "fixtures_published"): Promise<void> {
  const now = new Date();
  const firestore = getFirebaseAdminFirestore();

  await firestore.doc(paths.tournament(TOURNAMENT_ID)).set({
    ownerUid: owner.uid,
    ownerTag: "ResultOwner",
    organisationName: "Result Org",
    slug: "result-cup",
    name: "Result Cup",
    nameLower: "result cup",
    description: "Result integration test.",
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
    registrationCount: 3,
    status,
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    leagueMatchesCompleted: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedMatch(
  matchId: string,
  options: {
    readonly home?: SeededUser;
    readonly away?: SeededUser;
    readonly matchday?: number;
    readonly status?: "scheduled" | "completed";
    readonly result?: Record<string, unknown> | null;
  } = {},
): Promise<void> {
  const home = options.home ?? playerA;
  const away = options.away ?? playerB;
  const now = new Date();

  await getFirebaseAdminFirestore()
    .doc(paths.tournamentMatch(TOURNAMENT_ID, matchId))
    .set({
      tournamentId: TOURNAMENT_ID,
      stage: "league",
      matchday: options.matchday ?? 1,
      homeUid: home.uid,
      awayUid: away.uid,
      homeTag: home.gamerTag,
      awayTag: away.gamerTag,
      participants: [home.uid, away.uid],
      status: options.status ?? "scheduled",
      scheduledAt: new Date(now.getTime() + 86_400_000),
      result: options.result ?? null,
      updatedAt: now,
    });
}

function enterContext(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID }) };
}

function matchContext(matchId: string): { params: Promise<{ id: string; matchId: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID, matchId }) };
}

function reportContext(reportId: string): {
  params: Promise<{ id: string; reportId: string }>;
} {
  return { params: Promise.resolve({ id: TOURNAMENT_ID, reportId }) };
}

async function enter(matchId = MATCH_A, homeGoals = 3, awayGoals = 1): Promise<Response> {
  return enterRoute(
    request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/enter`, {
      matchId,
      homeGoals,
      awayGoals,
    }),
    enterContext(),
  );
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function tournamentData(): Promise<Record<string, unknown>> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(TOURNAMENT_ID)).get();
  return snapshot.data() ?? {};
}

async function matchData(matchId: string): Promise<Record<string, unknown>> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentMatch(TOURNAMENT_ID, matchId))
    .get();
  return snapshot.data() ?? {};
}

async function auditCount(action: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.auditLogs())
    .where("action", "==", action)
    .where("tournamentId", "==", TOURNAMENT_ID)
    .get();

  return snapshot.size;
}

async function notificationTitles(uid: string): Promise<string[]> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.userNotifications(uid)).get();

  return snapshot.docs.map((document) => String(document.data().title));
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();

  owner = await createUser({
    email: "result-owner@example.com",
    role: "organiser",
    gamerTag: "ResultOwner",
  });
  otherOrganiser = await createUser({
    email: "result-other@example.com",
    role: "organiser",
    gamerTag: "OtherOrganiser",
  });
  superAdmin = await createUser({
    email: "result-root@example.com",
    role: "super_admin",
    gamerTag: "RootAdmin",
  });
  plainPlayer = await createUser({
    email: "result-plain@example.com",
    role: "user",
    gamerTag: "PlainPlayer",
  });
  playerA = await createUser({
    email: "alice@example.com",
    role: "user",
    gamerTag: "Alice",
  });
  playerB = await createUser({
    email: "bob@example.com",
    role: "user",
    gamerTag: "Bob",
  });
  playerC = await createUser({
    email: "carol@example.com",
    role: "user",
    gamerTag: "Carol",
  });

  await createTournament();
  await seedMatch(MATCH_A);
  await seedMatch(MATCH_B, { home: playerC, away: playerA });
  await seedMatch(MATCH_C, { matchday: 2, home: playerB, away: playerC });
  sessionCookie.value = await sessionFor(owner);
});

afterAll(async () => {
  await clearEmulator();
});

describe("result entry", () => {
  it("records the score, moves the tournament into the league phase and notifies both players", async () => {
    const response = await enter();
    expect(response.status).toBe(200);

    const match = await matchData(MATCH_A);
    expect(match.status).toBe("completed");
    expect(match.result).toMatchObject({
      homeGoals: 3,
      awayGoals: 1,
      enteredBy: owner.uid,
      editCount: 0,
    });

    const tournament = await tournamentData();
    expect(tournament.status).toBe("league_phase");
    expect(tournament.leagueMatchesCompleted).toBe(1);
    expect(await auditCount("match.result_entered")).toBe(1);

    expect(await notificationTitles(playerA.uid)).toContain("Result recorded: you vs Bob, 3-1");
    expect(await notificationTitles(playerB.uid)).toContain("Result recorded: you vs Alice, 1-3");
  });

  it("rejects a second entry for the same match with a correction hint", async () => {
    expect((await enter()).status).toBe(200);

    const second = await enter(MATCH_A, 4, 0);
    expect(second.status).toBe(409);
    expect(String((await bodyOf(second)).error)).toContain("correct");

    const match = await matchData(MATCH_A);
    expect(match.result).toMatchObject({ homeGoals: 3, awayGoals: 1 });
    expect((await tournamentData()).leagueMatchesCompleted).toBe(1);
  });

  it("allows exactly one of two concurrent entries", async () => {
    const [first, second] = await Promise.all([enter(), enter(MATCH_A, 0, 9)]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const match = await matchData(MATCH_A);
    expect(match.status).toBe("completed");
    expect((await tournamentData()).leagueMatchesCompleted).toBe(1);
    expect(await auditCount("match.result_entered")).toBe(1);
  });

  it("refuses entry before fixtures are published", async () => {
    await createTournament("pots_confirmed");

    const response = await enter();
    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("fixtures are published");
  });

  it("returns 404 for another organiser and 403 for a plain player", async () => {
    sessionCookie.value = await sessionFor(otherOrganiser);
    expect((await enter()).status).toBe(404);

    sessionCookie.value = await sessionFor(plainPlayer);
    expect((await enter()).status).toBe(403);
  });

  it("lets a Super Admin record a result in any tournament", async () => {
    sessionCookie.value = await sessionFor(superAdmin);

    const response = await enter();
    expect(response.status).toBe(200);
    expect((await matchData(MATCH_A)).status).toBe("completed");
  });
});

describe("result correction and clearing", () => {
  beforeEach(async () => {
    expect((await enter()).status).toBe(200);
  });

  it("corrects a recorded score, increments the edit count and audits the reason", async () => {
    const response = await correctRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/correct`, {
        matchId: MATCH_A,
        homeGoals: 2,
        awayGoals: 2,
        reason: "Away goal was recorded to the wrong side.",
      }),
      enterContext(),
    );
    expect(response.status).toBe(200);

    const match = await matchData(MATCH_A);
    expect(match.result).toMatchObject({
      homeGoals: 2,
      awayGoals: 2,
      editCount: 1,
      lastEditedBy: owner.uid,
    });
    expect((await tournamentData()).leagueMatchesCompleted).toBe(1);

    const audits = await getFirebaseAdminFirestore()
      .collection(paths.auditLogs())
      .where("action", "==", "match.result_corrected")
      .where("tournamentId", "==", TOURNAMENT_ID)
      .get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0]?.data().reason).toContain("wrong side");
    expect(audits.docs[0]?.data().before).toMatchObject({ homeGoals: 3, awayGoals: 1 });
    expect(audits.docs[0]?.data().after).toMatchObject({ homeGoals: 2, awayGoals: 2 });
  });

  it("refuses a correction without a reason", async () => {
    const response = await correctRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/correct`, {
        matchId: MATCH_A,
        homeGoals: 2,
        awayGoals: 2,
        reason: "no",
      }),
      enterContext(),
    );
    expect(response.status).toBe(400);
  });

  it("clears a result, returns the fixture to scheduled and audits the reason", async () => {
    const response = await clearRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/clear`, {
        matchId: MATCH_A,
        reason: "The match was never played.",
      }),
      enterContext(),
    );
    expect(response.status).toBe(200);

    const match = await matchData(MATCH_A);
    expect(match.status).toBe("scheduled");
    expect(match.result).toBeNull();

    const tournament = await tournamentData();
    expect(tournament.leagueMatchesCompleted).toBe(0);
    expect(tournament.status).toBe("fixtures_published");
    expect(await auditCount("match.result_cleared")).toBe(1);
  });
});

describe("bulk result entry", () => {
  it("records every result in one transaction", async () => {
    const response = await bulkRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/bulk`, {
        results: [
          { matchId: MATCH_A, homeGoals: 1, awayGoals: 0 },
          { matchId: MATCH_B, homeGoals: 2, awayGoals: 2 },
          { matchId: MATCH_C, homeGoals: 0, awayGoals: 3 },
        ],
      }),
      enterContext(),
    );
    expect(response.status).toBe(200);
    expect((await bodyOf(response)).recorded).toBe(3);

    expect((await matchData(MATCH_A)).status).toBe("completed");
    expect((await matchData(MATCH_B)).result).toMatchObject({ homeGoals: 2, awayGoals: 2 });
    expect((await matchData(MATCH_C)).result).toMatchObject({ homeGoals: 0, awayGoals: 3 });

    const tournament = await tournamentData();
    expect(tournament.leagueMatchesCompleted).toBe(3);
    expect(tournament.status).toBe("league_phase");
    expect(await auditCount("match.result_entered")).toBe(3);
  });

  it("is all-or-nothing when one match already has a result", async () => {
    expect((await enter(MATCH_B)).status).toBe(200);

    const response = await bulkRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/bulk`, {
        results: [
          { matchId: MATCH_A, homeGoals: 1, awayGoals: 0 },
          { matchId: MATCH_B, homeGoals: 2, awayGoals: 2 },
        ],
      }),
      enterContext(),
    );
    expect(response.status).toBe(409);

    expect((await matchData(MATCH_A)).status).toBe("scheduled");
    expect((await matchData(MATCH_A)).result).toBeNull();
    expect((await matchData(MATCH_B)).result).toMatchObject({ homeGoals: 3, awayGoals: 1 });
    expect((await tournamentData()).leagueMatchesCompleted).toBe(1);
  });

  it("rejects nineteen results before touching any match", async () => {
    const results = Array.from({ length: 19 }, (_, index) => ({
      matchId: `bulk-${index}`,
      homeGoals: 1,
      awayGoals: 0,
    }));
    const response = await bulkRoute(
      request("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/bulk`, { results }),
      enterContext(),
    );

    expect(response.status).toBe(400);
    expect((await tournamentData()).leagueMatchesCompleted).toBe(0);
  });
});

describe("player result reports", () => {
  beforeEach(async () => {
    expect((await enter()).status).toBe(200);
  });

  async function openReport(reason = "The score is recorded backwards."): Promise<Response> {
    sessionCookie.value = await sessionFor(playerA);
    return reportRoute(
      request("POST", `/api/tournaments/${TOURNAMENT_ID}/matches/${MATCH_A}/report`, { reason }),
      matchContext(MATCH_A),
    );
  }

  it("lets a participant open one report and notifies the organiser", async () => {
    const response = await openReport();
    expect(response.status).toBe(200);

    const reportId = String((await bodyOf(response)).reportId);
    const reports = await getFirebaseAdminFirestore()
      .collection(paths.tournamentResultReports(TOURNAMENT_ID))
      .get();
    expect(reports.size).toBe(1);
    expect(reports.docs[0]?.id).toBe(reportId);
    expect(reports.docs[0]?.data()).toMatchObject({
      tournamentId: TOURNAMENT_ID,
      matchId: MATCH_A,
      reportedBy: playerA.uid,
      status: "open",
    });

    expect(await auditCount("result_report.created")).toBe(1);
    expect(await notificationTitles(owner.uid)).toContain("Result problem reported by Alice");
  });

  it("refuses a second open report by the same player for the same match", async () => {
    expect((await openReport()).status).toBe(200);

    const second = await openReport("This is a second complaint about the same match.");
    expect(second.status).toBe(409);
    expect(String((await bodyOf(second)).error)).toContain("already have an open report");
  });

  it("refuses a report from a non-participant and from a plain user", async () => {
    sessionCookie.value = await sessionFor(plainPlayer);
    const response = await reportRoute(
      request("POST", `/api/tournaments/${TOURNAMENT_ID}/matches/${MATCH_A}/report`, {
        reason: "I did not play in this match but I want to complain.",
      }),
      matchContext(MATCH_A),
    );

    expect(response.status).toBe(403);
  });

  it("requires a description of at least ten characters", async () => {
    const response = await openReport("short");
    expect(response.status).toBe(400);
  });

  it("resolves a report with a note, notifies the reporter and audits the decision", async () => {
    const opened = await openReport();
    const reportId = String((await bodyOf(opened)).reportId);

    sessionCookie.value = await sessionFor(owner);
    const response = await resolveRoute(
      request(
        "POST",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/result-reports/${reportId}/resolve`,
        { decision: "resolved", adminNote: "The score was corrected on the Results page." },
      ),
      reportContext(reportId),
    );
    expect(response.status).toBe(200);

    const stored = await getFirebaseAdminFirestore()
      .doc(paths.tournamentResultReport(TOURNAMENT_ID, reportId))
      .get();
    expect(stored.data()).toMatchObject({
      status: "resolved",
      resolvedBy: owner.uid,
      adminNote: "The score was corrected on the Results page.",
    });
    expect(await auditCount("result_report.resolved")).toBe(1);
    expect(await notificationTitles(playerA.uid)).toContain("Your result report was resolved");

    // A resolved report no longer blocks a new open one.
    expect((await openReport("The corrected score is still wrong.")).status).toBe(200);
  });

  it("refuses resolution by another organiser and needs a note", async () => {
    const opened = await openReport();
    const reportId = String((await bodyOf(opened)).reportId);

    sessionCookie.value = await sessionFor(owner);
    const missingNote = await resolveRoute(
      request(
        "POST",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/result-reports/${reportId}/resolve`,
        { decision: "dismissed", adminNote: "no" },
      ),
      reportContext(reportId),
    );
    expect(missingNote.status).toBe(400);

    sessionCookie.value = await sessionFor(otherOrganiser);
    const notOwner = await resolveRoute(
      request(
        "POST",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/result-reports/${reportId}/resolve`,
        { decision: "dismissed", adminNote: "Nothing to change here." },
      ),
      reportContext(reportId),
    );
    expect(notOwner.status).toBe(404);
  });
});
