// GCC - knockout engine tests.
//
// The pure bracket is the whole competition format, so these tests cover:
// hand-computed home advantage and aggregate arithmetic, every tie outcome,
// determinism for a recorded seed, 2,000-seed validity of both draws and the
// full progression to a champion, the seeds-1-and-2 separation rule, draw
// fairness and mutation tests proving the validator catches a broken bracket.
import { describe, expect, it } from "vitest";

import {
  applyDecider,
  awayUidForLeg,
  buildNextRound,
  buildPlayoffTies,
  buildRoundOf16Ties,
  homeUidForLeg,
  KNOCKOUT_ROUND_TIE_COUNTS,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_OPPONENT_GROUP,
  resolveTie,
  validateKnockoutRound,
  validateProgression,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutTie,
  type PlayoffGroup,
  type PlayoffWinner,
} from "@/lib/engine/knockout";

function standings36(): KnockoutPlayer[] {
  return Array.from({ length: 36 }, (_, index) => ({
    playerId: `p${String(index + 1).padStart(2, "0")}`,
    position: index + 1,
    gamerTag: `Player ${index + 1}`,
  }));
}

function playerAt(position: number): KnockoutPlayer {
  return {
    playerId: `p${String(position).padStart(2, "0")}`,
    position,
    gamerTag: `Player ${position}`,
  };
}

function tie(overrides: Partial<KnockoutTie> = {}): KnockoutTie {
  return {
    tieId: "t1",
    round: "r16",
    bracketSlot: 1,
    legs: 2,
    higherSeedUid: "p01",
    lowerSeedUid: "p16",
    higherSeedPosition: 1,
    lowerSeedPosition: 16,
    group: null,
    sourceTieIds: [],
    winnerUid: null,
    winnerPosition: null,
    ...overrides,
  };
}

function match(
  homeUid: string,
  awayUid: string,
  homeGoals: number | null,
  awayGoals: number | null,
  leg = 1,
): KnockoutMatch {
  return { leg, homeUid, awayUid, homeGoals, awayGoals };
}

/** Completes every tie in a round, alternating winner to keep it deterministic. */
function completeRound(ties: readonly KnockoutTie[], startIndex = 0): KnockoutTie[] {
  return ties.map((current, index) => {
    const higherWins = (index + startIndex) % 2 === 0;

    return {
      ...current,
      winnerUid: higherWins ? current.higherSeedUid : current.lowerSeedUid,
      winnerPosition: higherWins ? current.higherSeedPosition : current.lowerSeedPosition,
    };
  });
}

function playoffWinners(ties: readonly KnockoutTie[]): PlayoffWinner[] {
  return completeRound(ties).map((current) => ({
    playerId: current.winnerUid as string,
    position: current.winnerPosition as number,
    group: current.group as PlayoffWinner["group"],
    tieId: current.tieId,
  }));
}

function fullBracket(seed: string): {
  readonly rounds: Readonly<Record<KnockoutRound, readonly KnockoutTie[]>>;
  readonly completed: Readonly<Record<KnockoutRound, readonly KnockoutTie[]>>;
} {
  const standings = standings36();
  const playoff = buildPlayoffTies({ standings, seed });
  const r16 = buildRoundOf16Ties({
    directQualifiers: standings.filter((player) => player.position <= 8),
    playoffWinners: playoffWinners(playoff),
    seed,
  });
  const completedPlayoff = completeRound(playoff, 1);
  const completedR16 = completeRound(r16);
  const qf = buildNextRound(completedR16, 2);
  const completedQf = completeRound(qf);
  const sf = buildNextRound(completedQf, 2);
  const completedSf = completeRound(sf);
  const final = buildNextRound(completedSf, 2);
  const completedFinal = completeRound(final);

  return {
    rounds: { playoff, r16, qf, sf, final },
    completed: {
      playoff: completedPlayoff,
      r16: completedR16,
      qf: completedQf,
      sf: completedSf,
      final: completedFinal,
    },
  };
}

describe("home advantage", () => {
  it("gives the first leg to the lower-ranked player and the second to the higher", () => {
    const current = tie();

    expect(homeUidForLeg(current, 1)).toBe("p16");
    expect(awayUidForLeg(current, 1)).toBe("p01");
    expect(homeUidForLeg(current, 2)).toBe("p01");
    expect(awayUidForLeg(current, 2)).toBe("p16");
  });

  it("lists the higher-ranked player first in a single match", () => {
    const current = tie({ legs: 1 });

    expect(homeUidForLeg(current, 1)).toBe("p01");
    expect(awayUidForLeg(current, 1)).toBe("p16");
  });

  it("rejects a leg that does not exist", () => {
    expect(() => homeUidForLeg(tie(), 3)).toThrow();
    expect(() => homeUidForLeg(tie({ legs: 1 }), 2)).toThrow();
  });
});

describe("tie resolution", () => {
  it("is pending when no leg has a score", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", null, null, 1),
      match("p01", "p16", null, null, 2),
    ]);

    expect(resolution.status).toBe("pending");
    expect(resolution.legsPlayed).toBe(0);
    expect(resolution.winnerUid).toBeNull();
  });

  it("is in progress after one completed leg", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 1, 2, 1),
      match("p01", "p16", null, null, 2),
    ]);

    expect(resolution.status).toBe("in_progress");
    expect(resolution.legsPlayed).toBe(1);
  });

  it("aggregates a two-legged win regardless of venue", () => {
    const current = tie();
    // Leg 1: lower seed wins 2-0 at home. Leg 2: higher seed wins 3-1 at home.
    const resolution = resolveTie(current, [
      match("p16", "p01", 2, 0, 1),
      match("p01", "p16", 3, 1, 2),
    ]);

    expect(resolution.aggregate).toEqual({ higherGoals: 3, lowerGoals: 3 });
    expect(resolution.status).toBe("needs_decider");
  });

  it("aggregates goals for the higher seed from both venues", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 0, 1, 1),
      match("p01", "p16", 2, 0, 2),
    ]);

    expect(resolution.aggregate).toEqual({ higherGoals: 3, lowerGoals: 0 });
    expect(resolution.status).toBe("completed");
    expect(resolution.winnerUid).toBe("p01");
    expect(resolution.decidedBy).toBe("aggregate");
  });

  it("has no away-goals rule, so 1-1 needs a decider", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 1, 0, 1),
      match("p01", "p16", 1, 0, 2),
    ]);

    expect(resolution.aggregate).toEqual({ higherGoals: 1, lowerGoals: 1 });
    expect(resolution.status).toBe("needs_decider");
    expect(resolution.decidedBy).toBeNull();
  });

  it("resolves a single-match tie", () => {
    const current = tie({ legs: 1 });
    const resolution = resolveTie(current, [match("p01", "p16", 2, 4, 1)]);

    expect(resolution.status).toBe("completed");
    expect(resolution.winnerUid).toBe("p16");
    expect(resolution.decidedBy).toBe("aggregate");
  });

  it("rejects a match played at the wrong venue", () => {
    expect(() => resolveTie(tie(), [match("p01", "p16", 1, 0, 1)])).toThrow(/home or away/);
  });

  it("rejects duplicate legs and half-entered scores", () => {
    expect(() =>
      resolveTie(tie(), [match("p16", "p01", 1, 0, 1), match("p16", "p01", 1, 0, 1)]),
    ).toThrow(/more than one leg/);

    expect(() => resolveTie(tie(), [match("p16", "p01", 1, null, 1)])).toThrow(
      /both scores or neither/,
    );
  });
});

describe("deciders", () => {
  it("accepts extra time for a level tie", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 1, 1, 1),
      match("p01", "p16", 0, 0, 2),
    ]);
    const decided = applyDecider(resolution, current, {
      winnerUid: "p16",
      method: "extra_time",
      note: "Won in extra time",
      penalties: null,
    });

    expect(decided.status).toBe("completed");
    expect(decided.winnerUid).toBe("p16");
    expect(decided.decidedBy).toBe("extra_time");
  });

  it("accepts consistent penalties and rejects inconsistent ones", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 0, 0, 1),
      match("p01", "p16", 0, 0, 2),
    ]);
    const decided = applyDecider(resolution, current, {
      winnerUid: "p01",
      method: "penalties",
      note: null,
      penalties: { higher: 5, lower: 4 },
    });

    expect(decided.decidedBy).toBe("penalties");
    expect(decided.winnerUid).toBe("p01");

    expect(() =>
      applyDecider(resolution, current, {
        winnerUid: "p16",
        method: "penalties",
        note: null,
        penalties: { higher: 5, lower: 4 },
      }),
    ).toThrow(/must agree/);

    expect(() =>
      applyDecider(resolution, current, {
        winnerUid: "p01",
        method: "penalties",
        note: null,
        penalties: { higher: 4, lower: 4 },
      }),
    ).toThrow(/cannot be level/);
  });

  it("refuses a decider for a tie that is not level or not finished", () => {
    const current = tie();
    const won = resolveTie(current, [match("p16", "p01", 0, 1, 1), match("p01", "p16", 1, 0, 2)]);

    expect(() =>
      applyDecider(won, current, {
        winnerUid: "p01",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/level on aggregate/);

    const pending = resolveTie(current, []);
    expect(() =>
      applyDecider(pending, current, {
        winnerUid: "p01",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/level on aggregate/);
  });

  it("refuses a winner who is not in the tie", () => {
    const current = tie();
    const resolution = resolveTie(current, [
      match("p16", "p01", 0, 0, 1),
      match("p01", "p16", 0, 0, 2),
    ]);

    expect(() =>
      applyDecider(resolution, current, {
        winnerUid: "p99",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/two tied players/);
  });
});

describe("draw generation", () => {
  it("builds eight play-off ties with the published group pairs", () => {
    const ties = buildPlayoffTies({ standings: standings36(), seed: "draw-1" });

    expect(ties).toHaveLength(8);
    expect(validateKnockoutRound({ round: "playoff", ties })).toEqual({
      valid: true,
      issues: [],
    });

    for (const group of PLAYOFF_GROUPS) {
      const groupTies = ties.filter((current) => current.group === group);
      const definition = PLAYOFF_GROUP_SEEDS[group];

      expect(groupTies).toHaveLength(2);
      expect(
        groupTies.every(
          (current) =>
            definition.seeded.includes(current.higherSeedPosition) &&
            definition.unseeded.includes(current.lowerSeedPosition),
        ),
      ).toBe(true);
    }
  });

  it("builds a valid Round of 16 with the published group mapping", () => {
    const standings = standings36();
    const playoff = buildPlayoffTies({ standings, seed: "draw-1" });
    const r16 = buildRoundOf16Ties({
      directQualifiers: standings.filter((player) => player.position <= 8),
      playoffWinners: playoffWinners(playoff),
      seed: "draw-1",
    });

    expect(r16).toHaveLength(8);
    expect(validateKnockoutRound({ round: "r16", ties: r16 })).toEqual({
      valid: true,
      issues: [],
    });

    for (const current of r16) {
      expect(current.higherSeedPosition).toBeLessThanOrEqual(8);
      expect(current.group).toBe(R16_OPPONENT_GROUP[current.higherSeedPosition]);
    }
  });

  it("is deterministic for a recorded seed and varies between seeds", () => {
    const first = buildPlayoffTies({ standings: standings36(), seed: "same-seed" });
    const second = buildPlayoffTies({ standings: standings36(), seed: "same-seed" });

    expect(second).toEqual(first);

    const signatures = new Set(
      Array.from({ length: 20 }, (_, index) =>
        buildPlayoffTies({
          standings: standings36(),
          seed: `seed-${index}`,
        })
          .map((current) => `${current.tieId}:${current.lowerSeedUid}`)
          .join("|"),
      ),
    );

    expect(signatures.size).toBeGreaterThan(1);
  });

  it("rejects a missing player, duplicate position and an empty seed", () => {
    const standings = standings36().filter((player) => player.position !== 9);

    expect(() => buildPlayoffTies({ standings, seed: "draw-1" })).toThrow(/position 9/);

    const duplicate = [...standings36(), playerAt(9)];
    expect(() => buildPlayoffTies({ standings: duplicate, seed: "draw-1" })).toThrow(
      /more than once/,
    );

    expect(() => buildPlayoffTies({ standings: standings36(), seed: "  " })).toThrow(/seed/);
  });

  it("rejects an incomplete set of play-off winners", () => {
    const standings = standings36();
    const playoff = buildPlayoffTies({ standings, seed: "draw-1" });
    const winners = playoffWinners(playoff).slice(0, 7);

    expect(() =>
      buildRoundOf16Ties({
        directQualifiers: standings.filter((player) => player.position <= 8),
        playoffWinners: winners,
        seed: "draw-1",
      }),
    ).toThrow();
  });
});

describe("2,000-seed bracket properties", () => {
  it("generates valid rounds every time and never meets seeds 1 and 2 before the final", () => {
    for (let index = 0; index < 2000; index += 1) {
      const seed = `property-${index}`;
      const { rounds, completed } = fullBracket(seed);

      for (const round of ["playoff", "r16", "qf", "sf", "final"] as const) {
        expect(validateKnockoutRound({ round, ties: rounds[round] })).toEqual({
          valid: true,
          issues: [],
        });
      }

      expect(rounds.playoff).toHaveLength(KNOCKOUT_ROUND_TIE_COUNTS.playoff);
      expect(rounds.r16).toHaveLength(8);
      expect(rounds.qf).toHaveLength(4);
      expect(rounds.sf).toHaveLength(2);
      expect(rounds.final).toHaveLength(1);

      const seedOneTie = rounds.r16.find((current) =>
        [current.higherSeedPosition, current.lowerSeedPosition].includes(1),
      );
      const seedTwoTie = rounds.r16.find((current) =>
        [current.higherSeedPosition, current.lowerSeedPosition].includes(2),
      );

      expect(seedOneTie?.bracketSlot).toBeLessThanOrEqual(4);
      expect(seedTwoTie?.bracketSlot).toBeGreaterThanOrEqual(5);

      const seedOneQf = rounds.qf.find((current) =>
        current.sourceTieIds.includes(seedOneTie?.tieId as string),
      );
      const seedTwoQf = rounds.qf.find((current) =>
        current.sourceTieIds.includes(seedTwoTie?.tieId as string),
      );
      const seedOneSf = rounds.sf.find((current) =>
        current.sourceTieIds.includes(seedOneQf?.tieId as string),
      );
      const seedTwoSf = rounds.sf.find((current) =>
        current.sourceTieIds.includes(seedTwoQf?.tieId as string),
      );

      expect(seedOneSf?.tieId).not.toBe(seedTwoSf?.tieId);

      expect(validateProgression(completed.r16, rounds.qf).valid).toBe(true);
      expect(validateProgression(completed.qf, rounds.sf).valid).toBe(true);
      expect(validateProgression(completed.sf, rounds.final).valid).toBe(true);
    }
  });

  it("draws both group pairings fairly within five percentage points", () => {
    const trials = 2000;
    const playoffPairings = new Map<string, number>();
    const r16Pairings = new Map<string, number>();
    const standings = standings36();

    for (let index = 0; index < trials; index += 1) {
      const seed = `fairness-${index}`;
      const playoff = buildPlayoffTies({ standings, seed });
      const r16 = buildRoundOf16Ties({
        directQualifiers: standings.filter((player) => player.position <= 8),
        playoffWinners: playoffWinners(playoff),
        seed,
      });

      for (const current of playoff) {
        const key = `${current.higherSeedPosition}:${current.lowerSeedPosition}`;
        playoffPairings.set(key, (playoffPairings.get(key) ?? 0) + 1);
      }

      for (const current of r16) {
        const key = `${current.higherSeedPosition}:${current.sourceTieIds[0]}`;
        r16Pairings.set(key, (r16Pairings.get(key) ?? 0) + 1);
      }
    }

    // Every seeded/unseeded pairing in a play-off group is possible.
    for (const group of PLAYOFF_GROUPS) {
      const definition = PLAYOFF_GROUP_SEEDS[group];

      for (const seeded of definition.seeded) {
        const counts = definition.unseeded.map(
          (unseeded) => playoffPairings.get(`${seeded}:${unseeded}`) ?? 0,
        );
        const total = counts.reduce((sum, count) => sum + count, 0);

        expect(total).toBe(trials);

        for (const count of counts) {
          expect(Math.abs(count / total - 0.5)).toBeLessThanOrEqual(0.05);
        }
      }
    }

    // Within each qualifying pair, each group winner is assigned to each
    // direct seed about half the time.
    for (let direct = 1; direct <= 8; direct += 1) {
      const counts = [...r16Pairings.entries()]
        .filter(([key]) => Number(key.split(":")[0]) === direct)
        .map(([, count]) => count);
      const total = counts.reduce((sum, count) => sum + count, 0);

      expect(counts).toHaveLength(2);
      expect(total).toBe(trials);

      for (const count of counts) {
        expect(Math.abs(count / total - 0.5)).toBeLessThanOrEqual(0.05);
      }
    }
  });
});

describe("progression", () => {
  it("pairs adjacent bracket slots in order", () => {
    const { rounds } = fullBracket("progression-seed");

    rounds.qf.forEach((current, index) => {
      const expected = [rounds.r16[index * 2]?.tieId, rounds.r16[index * 2 + 1]?.tieId].sort();
      expect([...current.sourceTieIds].sort()).toEqual(expected);
      expect(current.bracketSlot).toBe(index + 1);
    });
  });

  it("refuses to build a round before every tie has a winner", () => {
    const { rounds } = fullBracket("progression-seed");
    const incomplete = rounds.r16.map((current, index) =>
      index === 0 ? { ...current, winnerUid: null } : current,
    );

    expect(() => buildNextRound(incomplete, 2)).toThrow(/no winner/);
  });

  it("refuses to build the Round of 16 with buildNextRound", () => {
    const playoff = buildPlayoffTies({ standings: standings36(), seed: "progression" });
    expect(() => buildNextRound(completeRound(playoff), 2)).toThrow(/play-off winners/);
  });

  it("always makes the final a single match", () => {
    const { rounds } = fullBracket("progression-seed");
    expect(rounds.final[0]?.legs).toBe(1);
  });

  it("detects a broken progression", () => {
    const { rounds, completed } = fullBracket("progression-seed");
    const tampered = rounds.qf.map((current) =>
      current.bracketSlot === 1 ? { ...current, sourceTieIds: ["r16-3", "r16-4"] } : current,
    );

    expect(validateProgression(completed.r16, tampered).valid).toBe(false);
  });
});

describe("independent validator", () => {
  it("catches a duplicate player", () => {
    const { rounds } = fullBracket("mutation-seed");
    const broken = rounds.r16.map((current, index) =>
      index === 1 ? { ...current, higherSeedUid: rounds.r16[0]?.higherSeedUid as string } : current,
    );

    expect(validateKnockoutRound({ round: "r16", ties: broken }).valid).toBe(false);
  });

  it("catches the wrong play-off group for a direct seed", () => {
    const { rounds } = fullBracket("mutation-seed");
    const broken = rounds.r16.map((current, index) =>
      index === 0
        ? { ...current, group: (current.group === "A" ? "B" : "A") as PlayoffGroup }
        : current,
    );

    expect(validateKnockoutRound({ round: "r16", ties: broken }).valid).toBe(false);
  });

  it("catches seeds 1 and 2 on the same half", () => {
    const { rounds } = fullBracket("mutation-seed");
    const broken = rounds.r16.map((current) => {
      if (current.bracketSlot === 5) {
        return { ...current, bracketSlot: 2 };
      }
      if (current.bracketSlot === 2) {
        return { ...current, bracketSlot: 5 };
      }
      return current;
    });

    expect(validateKnockoutRound({ round: "r16", ties: broken }).valid).toBe(false);
  });

  it("catches a missing tie, an invalid leg count and a two-legged final", () => {
    const { rounds } = fullBracket("mutation-seed");

    expect(validateKnockoutRound({ round: "qf", ties: rounds.qf.slice(0, 3) }).valid).toBe(false);

    const badLegs = rounds.qf.map((current, index) =>
      index === 0 ? { ...current, legs: 3 as unknown as 1 | 2 } : current,
    );
    expect(validateKnockoutRound({ round: "qf", ties: badLegs }).valid).toBe(false);

    const twoLeggedFinal = rounds.final.map((current) => ({ ...current, legs: 2 as const }));
    expect(validateKnockoutRound({ round: "final", ties: twoLeggedFinal }).valid).toBe(false);
  });

  it("catches a reversed ranking", () => {
    const { rounds } = fullBracket("mutation-seed");
    const broken = rounds.qf.map((current, index) =>
      index === 0
        ? {
            ...current,
            higherSeedUid: current.lowerSeedUid,
            lowerSeedUid: current.higherSeedUid,
            higherSeedPosition: current.lowerSeedPosition,
            lowerSeedPosition: current.higherSeedPosition,
          }
        : current,
    );

    expect(validateKnockoutRound({ round: "qf", ties: broken }).valid).toBe(false);
  });
});
