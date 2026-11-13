// GCC - `npm run simulate` entry point.
//
// Builds one complete Phase 13 tournament in the Firebase emulators through the
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
      log: line,
    });

    console.log("");
    line(`Players: ${summary.playerCount}`);
    line(`League matches: ${summary.leagueMatches} (${summary.leagueResults} results)`);
    for (const round of summary.rounds) {
      const deciders =
        round.deciders.length === 0
          ? ""
          : ` · deciders: ${round.deciders
              .map((decider) => `${decider.tieId} (${decider.method})`)
              .join(", ")}`;
      line(
        `${round.round}: ${round.ties} tie${round.ties === 1 ? "" : "s"} · ${round.matches} match${round.matches === 1 ? "" : "es"}${deciders}`,
      );
    }
    line(`Knockout matches: ${summary.knockoutMatches}`);
    line(`Champion: ${summary.championTag}`);
    line(`Runner-up: ${summary.runnerUpTag}`);
    line(`League table frozen: ${summary.standingsFrozen ? "yes" : "no"}`);
    line(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
    line("-------------------------");
    console.log("");

    expect(summary.playerCount).toBe(36);
    expect(summary.leagueMatches).toBe(144);
    expect(summary.knockoutMatches).toBe(45);
    expect(summary.standingsFrozen).toBe(true);
    expect(summary.championUid).not.toBe(summary.runnerUpUid);
  }, 240_000);
});
