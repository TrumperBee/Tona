// GCC - `npm run simulate` entry point.
//
// Builds one complete Phase 13C tournament in the Firebase emulators through the
// real routes and prints a readable summary. The same runner powers the
// end-to-end integration test; this file only owns the console output.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

import { clearEmulatorData, runFullTournamentSimulation } from "./full-tournament";

function line(message: string): void {
  console.log(`  ${message}`);
}

beforeAll(async () => {
  await clearEmulatorData();
});

afterAll(async () => {
  await clearEmulatorData();
});

describe("tournament simulation", () => {
  it("builds a complete tournament in the emulator", async () => {
    console.log("\nGCC tournament simulation");
    line("-------------------------");

    const summary = await runFullTournamentSimulation({
      setSession: (cookie) => {
        sessionCookie.value = cookie;
      },
      seed: 20261313,
      legs: 2,
      log: line,
    });

    console.log("");
    line(`Players: ${summary.playerCount}`);
    line(`League matches: ${summary.leagueMatches} (${summary.leagueResults} results)`);
    line(`Knockout legs before the final: ${summary.legs} (final always one match)`);
    line(`Bracket seed: ${summary.seed.slice(0, 16)}...`);
    line(`Bracket hash: ${summary.bracketHash.slice(0, 16)}...`);
    for (const round of summary.rounds) {
      const deciders =
        round.deciders.length === 0
          ? ""
          : ` - deciders: ${round.deciders
              .map((decider) => `${decider.tieId} (${decider.method})`)
              .join(", ")}`;
      line(
        `${round.round}: ${round.ties} tie${round.ties === 1 ? "" : "s"} - ${round.matches} match${round.matches === 1 ? "" : "es"}${deciders}`,
      );
    }
    line(`Knockout matches: ${summary.knockoutMatches}`);
    line(`Champion: ${summary.championTag}`);
    line(`Runner-up: ${summary.runnerUpTag}`);
    line(`League table frozen: ${summary.standingsFrozen ? "yes" : "no"}`);

    const firestore = getFirebaseAdminFirestore();
    const [hall, ladders] = await Promise.all([
      firestore.collection(paths.hallOfFame()).get(),
      firestore.collection(paths.rankingsPlayers("efootball")).get(),
    ]);
    const inducted = hall.docs.find((document) => document.id === summary.tournamentId);
    line(`Hall of Fame entries: ${hall.size}`);
    line(`Rated players: ${ladders.size}`);
    line(
      `Champion record: ${inducted?.data().stats?.wins ?? 0}W ${inducted?.data().stats?.draws ?? 0}D ${inducted?.data().stats?.losses ?? 0}L`,
    );

    line(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
    line("-------------------------");
    console.log("");

    expect(summary.playerCount).toBe(36);
    expect(summary.leagueMatches).toBe(144);
    expect(summary.legs).toBe(2);
    expect(summary.knockoutMatches).toBe(45);
    expect(summary.standingsFrozen).toBe(true);
    expect(summary.championUid).not.toBe(summary.runnerUpUid);
    expect(hall.size).toBe(1);
    expect(ladders.size).toBe(36);
  }, 240_000);
});
