// GCC - emulator-backed integration tests for Phase 13 knockout stages.
//
// These drive the real Admin SDK, the real draw/fixture/result/knockout modules
// and the real route guards. The first test builds a whole 36-player tournament
// from the draw to the champion; the rest cover the prerequisites, the frozen
// result window, authorisation and concurrent publication.
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

import { GET as verifyStandingsRoute } from "@/app/api/organiser/tournaments/[id]/standings/verify/route";
import { POST as closeRoute } from "@/app/api/organiser/tournaments/[id]/knockout/close-league/route";
import { POST as completeRoute } from "@/app/api/organiser/tournaments/[id]/knockout/complete/route";
import { POST as drawRoute } from "@/app/api/organiser/tournaments/[id]/knockout/draw/route";
import { POST as publishRoute } from "@/app/api/organiser/tournaments/[id]/knockout/publish/route";
import { POST as correctRoute } from "@/app/api/organiser/tournaments/[id]/results/correct/route";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

import {
  buildRequest,
  clearEmulatorData,
  createEmulatorUser,
  createRandom,
  createSessionFor,
  createSimulationTournament,
  drawAndPublishRound,
  playKnockoutRound,
  readRoundTies,
  runFullTournamentSimulation,
  runLeaguePhase,
  seedLeagueState,
  type SimulationUser,
  type SimulationRound,
} from "./full-tournament";

const TOURNAMENT_ID = "knockout-cup";
const SLUG = "knockout-cup";

let owner: SimulationUser;
let otherOrganiser: SimulationUser;
let plainPlayer: SimulationUser;

function context(params: { id: string } = { id: TOURNAMENT_ID }): {
  params: Promise<{ id: string }>;
} {
  return { params: Promise.resolve(params) };
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function closeLeague(): Promise<Response> {
  return closeRoute(
    buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/knockout/close-league`),
    context(),
  );
}

async function draw(round: SimulationRound): Promise<Response> {
  return drawRoute(
    buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/knockout/draw`, { round }),
    context(),
  );
}

async function publish(round: SimulationRound): Promise<Response> {
  return publishRoute(
    buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/knockout/publish`, {
      round,
    }),
    context(),
  );
}

async function knockoutCollectionSize(collection: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore().collection(collection).get();
  return snapshot.size;
}

async function seedClosedLeague(): Promise<void> {
  await createSimulationTournament({
    tournamentId: TOURNAMENT_ID,
    slug: SLUG,
    name: "Knockout Cup",
    ownerUid: owner.uid,
    status: "league_phase",
  });
  await seedLeagueState({ tournamentId: TOURNAMENT_ID, completedMatches: 144 });
  const response = await closeLeague();
  expect(response.status).toBe(200);
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulatorData();

  owner = await createEmulatorUser({
    email: "knockout-owner@example.com",
    role: "organiser",
    gamerTag: "KnockoutOwner",
  });
  otherOrganiser = await createEmulatorUser({
    email: "knockout-other@example.com",
    role: "organiser",
    gamerTag: "OtherOrganiser",
  });
  plainPlayer = await createEmulatorUser({
    email: "knockout-player@example.com",
    role: "user",
    gamerTag: "PlainPlayer",
  });
  sessionCookie.value = await createSessionFor(owner);
});

afterAll(async () => {
  await clearEmulatorData();
});

describe("full tournament simulation", () => {
  it("runs 36 players from the league draw to a completed knockout", async () => {
    const summary = await runFullTournamentSimulation({
      setSession: (cookie) => {
        sessionCookie.value = cookie;
      },
      seed: 424242,
    });

    expect(summary.playerCount).toBe(36);
    expect(summary.leagueMatches).toBe(144);
    expect(summary.rounds.map((round) => round.ties)).toEqual([8, 8, 4, 2, 1]);
    expect(summary.rounds.map((round) => round.matches)).toEqual([16, 16, 8, 4, 1]);
    expect(summary.knockoutMatches).toBe(45);
    expect(summary.standingsFrozen).toBe(true);
    expect(summary.championUid).not.toBe(summary.runnerUpUid);

    const playoff = summary.rounds[0];
    expect(playoff?.deciders.some((decider) => decider.method === "penalties")).toBe(true);

    const firestore = getFirebaseAdminFirestore();
    const tournament =
      (await firestore.doc(paths.tournament(summary.tournamentId)).get()).data() ?? {};
    expect(tournament.status).toBe("completed");
    expect(tournament.championUid).toBe(summary.championUid);
    expect(tournament.runnerUpUid).toBe(summary.runnerUpUid);
    expect(tournament.completedAt).toBeTruthy();
    expect(tournament.leaguePhaseClosedAt).toBeTruthy();
    expect(tournament.knockoutRounds).toEqual(["playoff", "r16", "qf", "sf", "final"]);

    const ties = await firestore
      .collection(paths.tournamentKnockoutTies(summary.tournamentId))
      .get();
    expect(ties.size).toBe(23);
    expect(
      ties.docs.every((document) => {
        const data = document.data();
        return data.status === "completed" && typeof data.winnerUid === "string";
      }),
    ).toBe(true);

    const finalDocs = ties.docs.filter((document) => document.data().round === "final");
    expect(finalDocs).toHaveLength(1);
    expect(finalDocs[0]?.data().winnerUid).toBe(summary.championUid);
    expect(finalDocs[0]?.data().legs).toBe(1);

    const finalMatches = await firestore
      .collection(paths.tournamentMatches(summary.tournamentId))
      .where("stage", "==", "final")
      .get();
    expect(finalMatches.size).toBe(1);
    expect(finalMatches.docs[0]?.data().status).toBe("completed");

    const leagueMatches = await firestore
      .collection(paths.tournamentMatches(summary.tournamentId))
      .where("stage", "==", "league")
      .get();
    expect(leagueMatches.size).toBe(144);
    expect(leagueMatches.docs.every((document) => document.data().status === "completed")).toBe(
      true,
    );

    const standings = await firestore
      .collection(paths.tournamentStandings(summary.tournamentId))
      .get();
    expect(standings.size).toBe(36);
    expect(standings.docs.every((document) => document.data().provisional === false)).toBe(true);
    expect(new Set(standings.docs.map((document) => document.data().position)).size).toBe(36);

    const verified = await verifyStandingsRoute(
      buildRequest("GET", `/api/organiser/tournaments/${summary.tournamentId}/standings/verify`),
      context({ id: summary.tournamentId }),
    );
    expect(verified.status).toBe(200);
    expect((await bodyOf(verified)).ok).toBe(true);
  }, 180_000);
});

describe("league closure", () => {
  it("refuses to close the league while a result is missing", async () => {
    await createSimulationTournament({
      tournamentId: TOURNAMENT_ID,
      slug: SLUG,
      name: "Knockout Cup",
      ownerUid: owner.uid,
      status: "league_phase",
    });
    await seedLeagueState({ tournamentId: TOURNAMENT_ID, completedMatches: 143 });

    const response = await closeLeague();
    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("1 match");

    const tournament = await getFirebaseAdminFirestore().doc(paths.tournament(TOURNAMENT_ID)).get();
    expect(tournament.data()?.status).toBe("league_phase");
    expect(tournament.data()?.leaguePhaseClosedAt ?? null).toBeNull();
  });

  it("freezes every standings row when the league closes", async () => {
    await createSimulationTournament({
      tournamentId: TOURNAMENT_ID,
      slug: SLUG,
      name: "Knockout Cup",
      ownerUid: owner.uid,
      status: "league_phase",
    });
    await seedLeagueState({ tournamentId: TOURNAMENT_ID, completedMatches: 144 });

    const response = await closeLeague();
    expect(response.status).toBe(200);

    const standings = await getFirebaseAdminFirestore()
      .collection(paths.tournamentStandings(TOURNAMENT_ID))
      .get();
    expect(standings.docs.every((document) => document.data().provisional === false)).toBe(true);

    const audit = await getFirebaseAdminFirestore()
      .collection(paths.auditLogs())
      .where("action", "==", "tournament.league_phase.closed")
      .where("tournamentId", "==", TOURNAMENT_ID)
      .get();
    expect(audit.size).toBe(1);
  });
});

describe("draw prerequisites", () => {
  it("refuses every round until the previous round is fully decided", async () => {
    await seedClosedLeague();

    const earlyR16 = await draw("r16");
    expect(earlyR16.status).toBe(409);
    expect(String((await bodyOf(earlyR16)).error)).toContain("play-off");

    const playoff = await draw("playoff");
    expect(playoff.status).toBe(200);

    const published = await publish("playoff");
    expect(published.status).toBe(200);

    const earlyQuarterFinal = await draw("qf");
    expect(earlyQuarterFinal.status).toBe(409);
    expect(String((await bodyOf(earlyQuarterFinal)).error)).toContain("round of 16");

    const duplicates = await draw("playoff");
    expect(duplicates.status).toBe(409);
    expect(String((await bodyOf(duplicates)).error)).toContain("already been published");
  });
});

describe("knockout result locking", () => {
  it("blocks corrections once the next round is published", async () => {
    const random = createRandom(1337);
    await createSimulationTournament({
      tournamentId: TOURNAMENT_ID,
      slug: SLUG,
      name: "Knockout Cup",
      ownerUid: owner.uid,
    });
    await runLeaguePhase({ tournamentId: TOURNAMENT_ID, random });
    await drawAndPublishRound(TOURNAMENT_ID, "playoff");
    await playKnockoutRound({ tournamentId: TOURNAMENT_ID, round: "playoff", random });
    await drawAndPublishRound(TOURNAMENT_ID, "r16");

    const [tie] = await readRoundTies(TOURNAMENT_ID, "playoff");
    expect(tie).toBeTruthy();

    const response = await correctRoute(
      buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/correct`, {
        matchId: `${tie?.tieId}-l1`,
        homeGoals: 9,
        awayGoals: 0,
        reason: "Correcting the recorded play-off score",
      }),
      context(),
    );

    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("next round");
  });
});

describe("knockout authorisation", () => {
  it("hides the workspace from other organisers and refuses players", async () => {
    await seedClosedLeague();

    sessionCookie.value = await createSessionFor(otherOrganiser);
    const other = await draw("playoff");
    expect(other.status).toBe(404);

    sessionCookie.value = await createSessionFor(plainPlayer);
    const player = await draw("playoff");
    expect(player.status).toBe(403);

    sessionCookie.value = await createSessionFor(owner);
    const ownerDraw = await draw("playoff");
    expect(ownerDraw.status).toBe(200);
  });
});

describe("concurrent publication", () => {
  it("writes one set of ties and matches when publish is called twice", async () => {
    await seedClosedLeague();
    expect((await draw("playoff")).status).toBe(200);

    const [first, second] = await Promise.all([publish("playoff"), publish("playoff")]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    expect(await knockoutCollectionSize(paths.tournamentKnockoutTies(TOURNAMENT_ID))).toBe(8);

    const knockoutMatches = await getFirebaseAdminFirestore()
      .collection(paths.tournamentMatches(TOURNAMENT_ID))
      .where("stage", "==", "playoff")
      .get();
    expect(knockoutMatches.size).toBe(16);
  });
});

describe("completion", () => {
  it("refuses to complete the tournament without a decided final", async () => {
    await seedClosedLeague();

    const response = await completeRoute(
      buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/knockout/complete`, {}),
      context(),
    );

    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("final");
  });
});
