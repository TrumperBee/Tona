// GCC - emulator-backed integration tests for the Phase 13C knockout stage.
//
// One generate action builds all 23 ties, every leg is recorded through the
// ordinary result routes, and the winners advance (and the tournament completes)
// inside those same transactions. These tests drive the real Admin SDK, the real
// bracket module and the real route guards: no engine call is stubbed.
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
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

import {
  buildRequest,
  clearEmulatorData,
  correctKnockoutResult,
  createEmulatorUser,
  createRandom,
  createSessionFor,
  createSimulationTournament,
  decideKnockoutTie,
  generateKnockout,
  playKnockoutRound,
  readKnockoutTies,
  readRoundTies,
  readTie,
  readTieMatches,
  resetKnockout,
  runFullTournamentSimulation,
  seedLeagueState,
  type SimulationUser,
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

async function seedReadyLeague(completedMatches = 144): Promise<void> {
  await createSimulationTournament({
    tournamentId: TOURNAMENT_ID,
    slug: SLUG,
    name: "Knockout Cup",
    ownerUid: owner.uid,
    status: "league_phase",
  });
  await seedLeagueState({ tournamentId: TOURNAMENT_ID, completedMatches });
}

async function startKnockout(legs: 1 | 2 = 2): Promise<void> {
  await seedReadyLeague();
  const generated = await generateKnockout(TOURNAMENT_ID, legs);
  expect(generated.status).toBe(200);
  expect(generated.body.tieCount).toBe(23);
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
  it("runs 36 players through a two-legged bracket to a champion", async () => {
    const summary = await runFullTournamentSimulation({
      setSession: (cookie) => {
        sessionCookie.value = cookie;
      },
      seed: 424242,
      legs: 2,
    });

    expect(summary.playerCount).toBe(36);
    expect(summary.leagueMatches).toBe(144);
    expect(summary.legs).toBe(2);
    expect(summary.rounds.map((round) => round.ties)).toEqual([8, 8, 4, 2, 1]);
    expect(summary.rounds.map((round) => round.matches)).toEqual([16, 16, 8, 4, 1]);
    expect(summary.knockoutMatches).toBe(45);
    expect(summary.standingsFrozen).toBe(true);
    expect(summary.championUid).not.toBe(summary.runnerUpUid);
    expect(summary.seed.length).toBeGreaterThan(0);
    expect(summary.bracketHash.length).toBe(64);

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
    expect(tournament.knockoutLegs).toBe(2);
    expect(tournament.knockoutSeed).toBe(summary.seed);
    expect(tournament.knockoutAlgorithmVersion).toBe(2);
    expect(tournament.knockoutBracketHash).toBe(summary.bracketHash);

    const ties = await readKnockoutTies(summary.tournamentId);
    expect(ties).toHaveLength(23);
    expect(ties.every((tie) => tie.status === "completed" && tie.winnerUid)).toBe(true);
    expect(ties.filter((tie) => tie.round !== "final").every((tie) => tie.legs === 2)).toBe(true);

    const finalTie = ties.find((tie) => tie.round === "final");
    expect(finalTie?.legs).toBe(1);
    expect(finalTie?.winnerUid).toBe(summary.championUid);

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

  it("runs the same bracket with single-match rounds", async () => {
    const summary = await runFullTournamentSimulation({
      tournamentId: "knockout-cup-single",
      slug: "knockout-cup-single",
      name: "Knockout Cup Single",
      setSession: (cookie) => {
        sessionCookie.value = cookie;
      },
      seed: 777001,
      legs: 1,
    });

    expect(summary.legs).toBe(1);
    expect(summary.rounds.map((round) => round.ties)).toEqual([8, 8, 4, 2, 1]);
    expect(summary.rounds.map((round) => round.matches)).toEqual([8, 8, 4, 2, 1]);
    expect(summary.knockoutMatches).toBe(23);
    expect(summary.championUid).not.toBe(summary.runnerUpUid);

    const ties = await readKnockoutTies(summary.tournamentId);
    expect(ties).toHaveLength(23);
    expect(ties.every((tie) => tie.legs === 1)).toBe(true);
    expect(ties.every((tie) => tie.status === "completed")).toBe(true);
  }, 180_000);
});

describe("generation prerequisites", () => {
  it("refuses to generate while a league result is missing", async () => {
    await seedReadyLeague(143);

    const response = await generateKnockout(TOURNAMENT_ID, 2);
    expect(response.status).toBe(409);
    expect(String(response.body.error)).toContain("1 match");

    const tournament = await getFirebaseAdminFirestore().doc(paths.tournament(TOURNAMENT_ID)).get();
    expect(tournament.data()?.status).toBe("league_phase");
    expect(tournament.data()?.knockoutSeed ?? null).toBeNull();
    expect(await readKnockoutTies(TOURNAMENT_ID)).toHaveLength(0);
  });

  it("freezes the table, writes all 23 ties and notifies all 36 players", async () => {
    await seedReadyLeague();

    const response = await generateKnockout(TOURNAMENT_ID, 2);
    expect(response.status).toBe(200);
    expect(response.body.generated).toBe(true);
    expect(response.body.tieCount).toBe(23);
    expect(response.body.matchCount).toBe(16);

    const firestore = getFirebaseAdminFirestore();
    const standings = await firestore.collection(paths.tournamentStandings(TOURNAMENT_ID)).get();
    expect(standings.size).toBe(36);
    expect(standings.docs.every((document) => document.data().provisional === false)).toBe(true);

    const ties = await readKnockoutTies(TOURNAMENT_ID);
    expect(ties).toHaveLength(23);
    // Every playoff tie is playable; every later tie waits for a source.
    expect(ties.filter((tie) => tie.higher.uid && tie.lower.uid)).toHaveLength(8);

    const registrations = await firestore
      .collection(paths.tournamentRegistrations(TOURNAMENT_ID))
      .get();
    expect(registrations.size).toBe(36);

    for (const registration of registrations.docs.slice(0, 3)) {
      const notifications = await firestore
        .collection(paths.userNotifications(registration.id))
        .get();
      expect(notifications.docs.some((document) => document.data().type === "tournament")).toBe(
        true,
      );
    }

    const audit = await firestore
      .collection(paths.auditLogs())
      .where("action", "==", "tournament.knockout.generated")
      .where("tournamentId", "==", TOURNAMENT_ID)
      .get();
    expect(audit.size).toBe(1);
  });

  it("returns the stored bracket when generate is called twice", async () => {
    await seedReadyLeague();

    const first = await generateKnockout(TOURNAMENT_ID, 2);
    const second = await generateKnockout(TOURNAMENT_ID, 1);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.generated).toBe(false);
    expect(second.body.seed).toBe(first.body.seed);
    expect(second.body.legs).toBe(2);

    expect(await readKnockoutTies(TOURNAMENT_ID)).toHaveLength(23);

    const knockoutMatches = await getFirebaseAdminFirestore()
      .collection(paths.tournamentMatches(TOURNAMENT_ID))
      .where("stage", "==", "playoff")
      .get();
    expect(knockoutMatches.size).toBe(16);
  });

  it("keeps the final to one match when the bracket uses two legs", async () => {
    await startKnockout(2);

    const ties = await readKnockoutTies(TOURNAMENT_ID);
    expect(ties.filter((tie) => tie.round === "final")).toHaveLength(1);
    expect(ties.find((tie) => tie.round === "final")?.legs).toBe(1);
    expect(ties.filter((tie) => tie.round !== "final").every((tie) => tie.legs === 2)).toBe(true);
  });
});

describe("knockout authorisation", () => {
  it("hides generation from other organisers and refuses players", async () => {
    await seedReadyLeague();

    sessionCookie.value = await createSessionFor(otherOrganiser);
    const other = await generateKnockout(TOURNAMENT_ID, 2);
    expect(other.status).toBe(404);

    sessionCookie.value = await createSessionFor(plainPlayer);
    const player = await generateKnockout(TOURNAMENT_ID, 2);
    expect(player.status).toBe(403);

    sessionCookie.value = await createSessionFor(owner);
    const ownerGenerate = await generateKnockout(TOURNAMENT_ID, 2);
    expect(ownerGenerate.status).toBe(200);
  });
});

describe("automatic advancement", () => {
  it("creates the next round's matches as soon as both sides are known", async () => {
    await startKnockout(2);

    const before = await readKnockoutTies(TOURNAMENT_ID);
    const unresolvedR16 = before.filter((tie) => tie.round === "r16" && !tie.lower.uid);
    expect(unresolvedR16.length).toBe(8);

    await playKnockoutRound({
      tournamentId: TOURNAMENT_ID,
      round: "playoff",
      random: createRandom(99),
    });

    const after = await readKnockoutTies(TOURNAMENT_ID);
    const r16 = after.filter((tie) => tie.round === "r16");
    expect(r16.every((tie) => tie.higher.uid && tie.lower.uid)).toBe(true);

    for (const tie of r16) {
      const matches = await readTieMatches(TOURNAMENT_ID, tie.tieId);
      expect(matches).toHaveLength(2);
      expect(matches.every((match) => match.status === "scheduled")).toBe(true);
    }
  });

  it("blocks a correction when a dependent tie already has a result", async () => {
    const random = createRandom(1337);
    await startKnockout(2);
    await playKnockoutRound({ tournamentId: TOURNAMENT_ID, round: "playoff", random });
    await playKnockoutRound({ tournamentId: TOURNAMENT_ID, round: "r16", random });

    const [tie] = await readRoundTies(TOURNAMENT_ID, "playoff");
    const [leg] = await readTieMatches(TOURNAMENT_ID, tie?.tieId ?? "");

    const response = await correctKnockoutResult(
      TOURNAMENT_ID,
      leg?.id ?? "",
      9,
      0,
      "Correcting the recorded play-off score",
    );

    expect(response.status).toBe(409);
    expect(String(response.body.error)).toContain("already has a result");
    expect(String(response.body.error)).toContain("R16");
  });

  it("moves a changed winner into the next round and rebuilds its untouched matches", async () => {
    const random = createRandom(2468);
    await startKnockout(2);
    await playKnockoutRound({ tournamentId: TOURNAMENT_ID, round: "playoff", random });

    const ties = await readKnockoutTies(TOURNAMENT_ID);
    const tie = ties.find((entry) => entry.round === "playoff" && entry.winnerUid);
    const beforeWinner = tie?.winnerUid ?? "";
    const otherUid = tie?.higher.uid === beforeWinner ? tie?.lower.uid : tie?.higher.uid;

    expect(beforeWinner.length).toBeGreaterThan(0);
    expect(otherUid).toBeTruthy();

    const dependentBefore = ties.find(
      (entry) =>
        (entry.higher.ref.type === "winnerOf" && entry.higher.ref.tieId === tie?.tieId) ||
        (entry.lower.ref.type === "winnerOf" && entry.lower.ref.tieId === tie?.tieId),
    );
    expect(dependentBefore).toBeTruthy();
    expect(
      dependentBefore?.higher.uid === beforeWinner || dependentBefore?.lower.uid === beforeWinner,
    ).toBe(true);

    const [legOne] = await readTieMatches(TOURNAMENT_ID, tie?.tieId ?? "");
    const legOneDoc = await getFirebaseAdminFirestore()
      .doc(paths.tournamentMatch(TOURNAMENT_ID, legOne?.id ?? ""))
      .get();
    const legHome = legOneDoc.data()?.homeUid;

    // Give the side that lost the tie a nine-goal swing in this leg. The other
    // leg is already recorded, so the aggregate flips.
    const corrected =
      beforeWinner === legHome
        ? await correctKnockoutResult(TOURNAMENT_ID, legOne?.id ?? "", 0, 9)
        : await correctKnockoutResult(TOURNAMENT_ID, legOne?.id ?? "", 9, 0);

    expect(corrected.status).toBe(200);

    const updatedTie = await readTie(TOURNAMENT_ID, tie?.tieId ?? "");
    expect(updatedTie.winnerUid).toBe(otherUid);

    const dependentAfter = (await readKnockoutTies(TOURNAMENT_ID)).find(
      (entry) =>
        (entry.higher.ref.type === "winnerOf" && entry.higher.ref.tieId === tie?.tieId) ||
        (entry.lower.ref.type === "winnerOf" && entry.lower.ref.tieId === tie?.tieId),
    );
    expect(dependentAfter?.higher.uid === otherUid || dependentAfter?.lower.uid === otherUid).toBe(
      true,
    );

    const rebuilt = await readTieMatches(TOURNAMENT_ID, dependentAfter?.tieId ?? "");
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt.every((match) => match.status === "scheduled")).toBe(true);
  });
});

describe("deciders", () => {
  it("records a penalties decider for a level single leg and advances the winner", async () => {
    await startKnockout(1);

    const [tie] = await readRoundTies(TOURNAMENT_ID, "playoff");
    const [match] = await readTieMatches(TOURNAMENT_ID, tie?.tieId ?? "");
    const entered = await import("@/app/api/organiser/tournaments/[id]/results/enter/route").then(
      (route) =>
        route.POST(
          buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/enter`, {
            matchId: match?.id,
            homeGoals: 1,
            awayGoals: 1,
          }),
          context(),
        ),
    );
    expect(entered.status).toBe(200);

    const level = await readTie(TOURNAMENT_ID, tie?.tieId ?? "");
    expect(level.status).toBe("needs_decider");

    const better =
      (level.higher.position ?? 99) <= (level.lower.position ?? 99) ? level.higher : level.lower;
    const decided = await decideKnockoutTie(TOURNAMENT_ID, tie?.tieId ?? "", {
      winnerUid: better.uid as string,
      method: "penalties",
      penalties: { higher: 5, lower: 4 },
    });
    expect(decided.status).toBe(200);

    const stored = await readTie(TOURNAMENT_ID, tie?.tieId ?? "");
    expect(stored.status).toBe("completed");
    expect(stored.winnerUid).toBe(better.uid);
  });
});

describe("reset", () => {
  it("deletes an unplayed bracket and returns to the league phase", async () => {
    await startKnockout(2);

    const response = await resetKnockout(TOURNAMENT_ID, "Wrong leg setting, regenerate");
    expect(response.status).toBe(200);
    expect(response.body.deletedTies).toBe(23);
    expect(response.body.deletedMatches).toBe(16);

    const firestore = getFirebaseAdminFirestore();
    const tournament = await firestore.doc(paths.tournament(TOURNAMENT_ID)).get();
    expect(tournament.data()?.status).toBe("league_phase");
    expect(tournament.data()?.knockoutSeed ?? null).toBeNull();
    expect(await readKnockoutTies(TOURNAMENT_ID)).toHaveLength(0);

    const knockoutMatches = await firestore
      .collection(paths.tournamentMatches(TOURNAMENT_ID))
      .where("stage", "==", "playoff")
      .get();
    expect(knockoutMatches.size).toBe(0);

    const audit = await firestore
      .collection(paths.auditLogs())
      .where("action", "==", "tournament.knockout.reset")
      .get();
    expect(audit.size).toBe(1);
  });

  it("refuses to reset once a knockout result exists", async () => {
    await startKnockout(2);

    const [tie] = await readRoundTies(TOURNAMENT_ID, "playoff");
    const [match] = await readTieMatches(TOURNAMENT_ID, tie?.tieId ?? "");
    const entered = await import("@/app/api/organiser/tournaments/[id]/results/enter/route").then(
      (route) =>
        route.POST(
          buildRequest("POST", `/api/organiser/tournaments/${TOURNAMENT_ID}/results/enter`, {
            matchId: match?.id,
            homeGoals: 2,
            awayGoals: 0,
          }),
          context(),
        ),
    );
    expect(entered.status).toBe(200);

    const response = await resetKnockout(TOURNAMENT_ID, "Trying to reset after a result");
    expect(response.status).toBe(409);
    expect(String(response.body.error)).toContain("recorded result");

    expect(await readKnockoutTies(TOURNAMENT_ID)).toHaveLength(23);
  });
});
