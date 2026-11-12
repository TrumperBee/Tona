// GCC - league-phase fixture engine tests.
//
// These tests exercise the pure generator and the independent validator with
// no emulator, no Firebase and no network. They cover:
//   * property validation and timing over 3,000 seeds,
//   * determinism and seed diversity,
//   * every structural corruption the validator must catch,
//   * pair fairness over 2,000 seeds, and
//   * a forced colouring failure returning a typed error.
import { describe, expect, it } from "vitest";

import { findEdgeColouring } from "@/lib/engine/fixtures/colouring";
import { generateLeaguePhase } from "@/lib/engine/fixtures/generate";
import {
  FixtureGenerationError,
  LEAGUE_MATCH_COUNT,
  LEAGUE_MATCHDAY_COUNT,
  LEAGUE_MATCHES_PER_MATCHDAY,
} from "@/lib/engine/fixtures/types";
import {
  validateLeaguePhase,
  type FixtureValidationCode,
  type LeagueFixtureInput,
} from "@/lib/engine/fixtures/validate";

function makePots(): string[][] {
  return [0, 1, 2, 3].map((pot) =>
    Array.from({ length: 9 }, (_, index) => `p${pot + 1}-${String(index + 1).padStart(2, "0")}`),
  );
}

interface MutableFixture {
  matchday: number;
  homeId: string;
  awayId: string;
}

function cloneFixtures(fixtures: readonly LeagueFixtureInput[]): MutableFixture[] {
  return fixtures.map((fixture) => ({ ...fixture }));
}

function codesOf(
  fixtures: readonly LeagueFixtureInput[],
  pots = makePots(),
): Set<FixtureValidationCode> {
  return new Set(validateLeaguePhase(pots, fixtures).errors.map((error) => error.code));
}

function pairKey(first: string, second: string): string {
  return first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`;
}

describe("generateLeaguePhase", () => {
  it("produces a valid schedule for 3,000 seeded generations", () => {
    const pots = makePots();
    const times: number[] = [];

    for (let index = 0; index < 3_000; index += 1) {
      const seed = `property-${index}`;
      const started = performance.now();
      const generation = generateLeaguePhase({ pots, seed });
      times.push(performance.now() - started);

      expect(generation.fixtures.length, seed).toBe(LEAGUE_MATCH_COUNT);
      expect(generation.attempts, seed).toBeLessThanOrEqual(50);
      expect(generation.report.perMatchdayCounts, seed).toEqual(
        new Array<number>(LEAGUE_MATCHDAY_COUNT).fill(LEAGUE_MATCHES_PER_MATCHDAY),
      );

      const validation = validateLeaguePhase(pots, generation.fixtures);

      if (!validation.valid) {
        throw new Error(
          `${seed} produced an invalid schedule: ${validation.errors
            .map((error) => `${error.code}: ${error.message}`)
            .join("; ")}`,
        );
      }

      expect(validation.stats.perMatchdayCounts, seed).toEqual(
        new Array<number>(LEAGUE_MATCHDAY_COUNT).fill(LEAGUE_MATCHES_PER_MATCHDAY),
      );
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)] as number;
    const max = times[times.length - 1] as number;
    const total = times.reduce((sum, value) => sum + value, 0);

    // Printed so the acceptance record can quote real timing numbers.
    console.log(
      `fixtures: 3000 seeds, avg ${(total / times.length).toFixed(2)}ms, ` +
        `p99 ${p99.toFixed(2)}ms, max ${max.toFixed(2)}ms`,
    );

    expect(p99).toBeLessThan(1000);
  }, 180_000);

  it("is byte-identical for the same pots and seed", () => {
    const pots = makePots();

    for (let index = 0; index < 25; index += 1) {
      const seed = `determinism-${index}`;
      const first = generateLeaguePhase({ pots, seed });
      const second = generateLeaguePhase({ pots, seed });

      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(second.report).toEqual(first.report);
    }
  });

  it("produces at least 99 distinct schedules from 100 seeds", () => {
    const pots = makePots();
    const schedules = new Set<string>();

    for (let index = 0; index < 100; index += 1) {
      const generation = generateLeaguePhase({ pots, seed: `diversity-${index}` });
      schedules.add(JSON.stringify(generation.fixtures));
    }

    expect(schedules.size).toBeGreaterThanOrEqual(99);
  });

  it("reports four home and four away matches per player", () => {
    const pots = makePots();
    const generation = generateLeaguePhase({ pots, seed: "stats" });
    const validation = validateLeaguePhase(pots, generation.fixtures);

    expect(validation.valid).toBe(true);
    expect(validation.stats.perPlayer).toHaveLength(36);

    for (const player of validation.stats.perPlayer) {
      expect(player.home).toBe(4);
      expect(player.away).toBe(4);
      expect(player.opponentsByPot).toEqual([2, 2, 2, 2]);
    }
  });

  it("returns a typed error when the colouring search cannot finish", () => {
    const pots = makePots();

    try {
      generateLeaguePhase(
        { pots, seed: "forced-failure" },
        { maxAttempts: 1, colourNodeBudget: 0 },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureGenerationError);
      expect((error as FixtureGenerationError).code).toBe("attempts-exhausted");
      expect((error as FixtureGenerationError).attempts).toBe(1);
      return;
    }

    throw new Error("Expected fixture generation to fail with a typed error.");
  });

  it("reports an impossible graph as uncolourable", () => {
    // An odd cycle has no proper 2-edge-colouring.
    const result = findEdgeColouring(
      [
        { u: 0, v: 1 },
        { u: 1, v: 2 },
        { u: 2, v: 0 },
      ],
      3,
      2,
      10_000,
    );

    expect(result.ok).toBe(false);
    expect(result.colours).toBeNull();
  });
});

describe("validateLeaguePhase corruptions", () => {
  const pots = makePots();
  const base = generateLeaguePhase({ pots, seed: "mutation-base" }).fixtures;

  it("accepts the untouched schedule", () => {
    expect(validateLeaguePhase(pots, base).valid).toBe(true);
  });

  it("detects a missing fixture", () => {
    const fixtures = cloneFixtures(base);
    fixtures.pop();

    expect(codesOf(fixtures)).toContain("match-count-invalid");
  });

  it("detects an out-of-range matchday", () => {
    const fixtures = cloneFixtures(base);
    (fixtures[0] as MutableFixture).matchday = 0;

    expect(codesOf(fixtures)).toContain("matchday-invalid");
  });

  it("detects a self-match", () => {
    const fixtures = cloneFixtures(base);
    const fixture = fixtures[0] as { matchday: number; homeId: string; awayId: string };
    fixture.awayId = fixture.homeId;

    expect(codesOf(fixtures)).toContain("self-match");
  });

  it("detects a repeated pairing", () => {
    const fixtures = cloneFixtures(base);
    fixtures[1] = { ...(fixtures[0] as MutableFixture) };

    expect(codesOf(fixtures)).toContain("pair-duplicate");
  });

  it("detects a player outside the pots", () => {
    const fixtures = cloneFixtures(base);
    (fixtures[0] as MutableFixture).homeId = "ghost";

    expect(codesOf(fixtures)).toContain("player-unknown");
  });

  it("detects a player appearing twice on one matchday", () => {
    const fixtures = cloneFixtures(base);
    const first = fixtures[0] as MutableFixture;
    const second = fixtures.find(
      (fixture, index) =>
        index > 0 &&
        fixture.matchday === first.matchday &&
        fixture.awayId !== first.homeId &&
        fixture.homeId !== first.awayId &&
        fixture.homeId !== first.homeId &&
        fixture.awayId !== first.awayId,
    ) as MutableFixture;

    second.homeId = first.homeId;

    expect(codesOf(fixtures)).toContain("matchday-player-duplicate");
  });

  it("detects a matchday with the wrong number of fixtures", () => {
    const fixtures = cloneFixtures(base);
    const moved = fixtures.find((fixture) => fixture.matchday === 1) as MutableFixture;
    moved.matchday = 2;

    expect(codesOf(fixtures)).toContain("matchday-match-count-invalid");
  });

  it("detects the wrong number of opponents from a pot", () => {
    const fixtures = cloneFixtures(base);
    const positionOf = new Map<string, number>();

    pots.forEach((pot, potIndex) => {
      pot.forEach((playerId) => positionOf.set(playerId, potIndex));
    });

    const original = fixtures[0] as MutableFixture;
    const originalPot = positionOf.get(original.awayId) as number;
    const usedPairs = new Set(fixtures.map((fixture) => pairKey(fixture.homeId, fixture.awayId)));

    const replacement = pots.flat().find((playerId) => {
      const candidatePot = positionOf.get(playerId) as number;

      return (
        playerId !== original.homeId &&
        candidatePot !== originalPot &&
        !usedPairs.has(pairKey(original.homeId, playerId))
      );
    }) as string;

    original.awayId = replacement;

    expect(codesOf(fixtures)).toContain("pot-opponent-count-invalid");
  });

  it("detects a one-sided home/away split against a pot", () => {
    const fixtures = cloneFixtures(base);
    const fixture = fixtures[0] as MutableFixture;
    const originalHome = fixture.homeId;
    const originalAway = fixture.awayId;

    fixture.homeId = originalAway;
    fixture.awayId = originalHome;

    expect(codesOf(fixtures)).toContain("pot-home-away-invalid");
  });

  it("validates the pot structure independently", () => {
    const duplicated = makePots();
    (duplicated[1] as string[])[0] = (duplicated[0] as string[])[0] as string;
    expect(codesOf(base, duplicated)).toContain("player-duplicate");

    const shortPot = makePots();
    (shortPot[0] as string[]).pop();
    expect(codesOf(base, shortPot)).toContain("pot-size-invalid");

    expect(codesOf(base, makePots().slice(0, 3))).toContain("pot-count-invalid");
  });
});

describe("pair fairness", () => {
  it("draws every pot pair at the expected rate over 2,000 seeds", () => {
    const pots = makePots();
    const potOf = new Map<string, number>();

    pots.forEach((pot, potIndex) => {
      pot.forEach((playerId) => potOf.set(playerId, potIndex));
    });

    const samePotCounts = new Map<string, number>();
    const crossPotCounts = new Map<string, number>();

    for (let firstPot = 0; firstPot < 4; firstPot += 1) {
      for (let firstIndex = 0; firstIndex < 9; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < 9; secondIndex += 1) {
          samePotCounts.set(
            pairKey(
              (pots[firstPot] as string[])[firstIndex] as string,
              (pots[firstPot] as string[])[secondIndex] as string,
            ),
            0,
          );
        }
      }
    }

    for (let firstPot = 0; firstPot < 4; firstPot += 1) {
      for (let secondPot = firstPot + 1; secondPot < 4; secondPot += 1) {
        for (let firstIndex = 0; firstIndex < 9; firstIndex += 1) {
          for (let secondIndex = 0; secondIndex < 9; secondIndex += 1) {
            crossPotCounts.set(
              pairKey(
                (pots[firstPot] as string[])[firstIndex] as string,
                (pots[secondPot] as string[])[secondIndex] as string,
              ),
              0,
            );
          }
        }
      }
    }

    const seeds = 2_000;

    for (let index = 0; index < seeds; index += 1) {
      const generation = generateLeaguePhase({ pots, seed: `fairness-${index}` });

      for (const fixture of generation.fixtures) {
        const key = pairKey(fixture.homeId, fixture.awayId);
        const homePot = potOf.get(fixture.homeId) as number;
        const awayPot = potOf.get(fixture.awayId) as number;

        if (homePot === awayPot) {
          samePotCounts.set(key, (samePotCounts.get(key) as number) + 1);
        } else {
          crossPotCounts.set(key, (crossPotCounts.get(key) as number) + 1);
        }
      }
    }

    const sameRates = [...samePotCounts.values()].map((count) => count / seeds);
    const crossRates = [...crossPotCounts.values()].map((count) => count / seeds);
    const sameRate = sameRates.reduce((sum, rate) => sum + rate, 0) / sameRates.length;
    const crossRate = crossRates.reduce((sum, rate) => sum + rate, 0) / crossRates.length;
    const sameMin = Math.min(...sameRates);
    const sameMax = Math.max(...sameRates);
    const crossMin = Math.min(...crossRates);
    const crossMax = Math.max(...crossRates);

    // Printed so the acceptance record can quote real fairness numbers.
    console.log(
      `fairness: same-pot ${sameRate.toFixed(4)} (min ${sameMin.toFixed(4)}, max ${sameMax.toFixed(4)}), ` +
        `cross-pot ${crossRate.toFixed(4)} (min ${crossMin.toFixed(4)}, max ${crossMax.toFixed(4)})`,
    );

    expect(sameRate).toBeGreaterThanOrEqual(0.21);
    expect(sameRate).toBeLessThanOrEqual(0.29);
    expect(crossRate).toBeGreaterThanOrEqual(0.18);
    expect(crossRate).toBeLessThanOrEqual(0.26);
    expect(sameMin).toBeGreaterThanOrEqual(0.21);
    expect(sameMax).toBeLessThanOrEqual(0.29);
    expect(crossMin).toBeGreaterThanOrEqual(0.18);
    expect(crossMax).toBeLessThanOrEqual(0.26);
  }, 180_000);
});
