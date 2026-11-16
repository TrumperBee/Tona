// GCC - knockout engine tests.
//
// The pure bracket is the whole competition format, so these tests cover:
// hand-computed home advantage and aggregate arithmetic, every tie outcome,
// determinism for a recorded seed, 2,000-seed validity of the whole bracket
// (including that seeds 1 and 2 only meet in the final), 500 complete bracket
// simulations for one and two legs with explicit deciders, play-off draw
// fairness and mutation tests proving the validator catches a broken bracket.
import { describe, expect, it } from "vitest";

import {
  advanceBracket,
  applyDecider,
  awayUidForLeg,
  buildKnockoutBracket,
  dependentTieIds,
  homeUidForLeg,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_TIE_COUNTS,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_OPPONENT_GROUP,
  resolveTie,
  roundTies,
  validateBracket,
  type BracketSlot,
  type BracketTie,
  type KnockoutBracket,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutSlot,
  type ResolvableTie,
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

function bracketFor(seed: string, legs: 1 | 2 = 2): KnockoutBracket {
  return buildKnockoutBracket({ standings: standings36(), seed, legs });
}

function resolvable(overrides: Partial<ResolvableTie> = {}): ResolvableTie {
  return {
    tieId: "t1",
    legs: 2,
    higherSeedUid: "p01",
    lowerSeedUid: "p16",
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

function requirePlayer(slot: BracketSlot): KnockoutPlayer {
  if (!slot.player) {
    throw new Error("Expected a resolved bracket slot.");
  }

  return slot.player;
}

function withTies(bracket: KnockoutBracket, ties: readonly BracketTie[]): KnockoutBracket {
  return { ...bracket, ties };
}

function replaceTie(
  bracket: KnockoutBracket,
  tieId: string,
  patch: (tie: BracketTie) => BracketTie,
): KnockoutBracket {
  return withTies(
    bracket,
    bracket.ties.map((tie) => (tie.tieId === tieId ? patch(tie) : tie)),
  );
}

interface SimulatedTie {
  readonly tie: BracketTie;
  readonly decider: "extra_time" | "penalties" | null;
}

/**
 * Plays every tie in bracket order through the real resolver: each leg gets a
 * deterministic score, a level aggregate is decided by extra time or penalties,
 * and only then is the winner written into the bracket.
 */
function playBracket(bracket: KnockoutBracket): {
  readonly bracket: KnockoutBracket;
  readonly deciders: readonly SimulatedTie[];
} {
  let current = bracket;
  const deciders: SimulatedTie[] = [];
  let index = 0;

  for (const round of KNOCKOUT_ROUNDS) {
    for (const tie of roundTies(current, round)) {
      const higher = requirePlayer(tie.higher);
      const lower = requirePlayer(tie.lower);
      const [better, worse] = higher.position < lower.position ? [higher, lower] : [lower, higher];
      const tieRef: ResolvableTie = {
        tieId: tie.tieId,
        legs: tie.legs,
        higherSeedUid: better.playerId,
        lowerSeedUid: worse.playerId,
      };
      const levelTie = index % 4 === 0;
      const matches: KnockoutMatch[] = [];

      for (let leg = 1; leg <= tie.legs; leg += 1) {
        const homeUid = homeUidForLeg(tieRef, leg);
        const awayUid = awayUidForLeg(tieRef, leg);
        const homeGoals = levelTie ? 1 : (index + leg * 2) % 4;
        const awayGoals = levelTie ? 1 : (index + leg * 3) % 3;

        matches.push(match(homeUid, awayUid, homeGoals, awayGoals, leg));
      }

      const resolution = resolveTie(tieRef, matches);
      let winnerUid: string | null = resolution.winnerUid;
      let decider: SimulatedTie["decider"] = null;

      if (resolution.status === "needs_decider") {
        decider = index % 2 === 0 ? "extra_time" : "penalties";
        const winner = index % 2 === 0 ? better : worse;
        const decided = applyDecider(resolution, tieRef, {
          winnerUid: winner.playerId,
          method: decider,
          note: decider === "extra_time" ? "Decided in extra time" : null,
          penalties:
            decider === "penalties"
              ? winner.playerId === tieRef.higherSeedUid
                ? { higher: 5, lower: 4 }
                : { higher: 4, lower: 5 }
              : null,
        });
        winnerUid = decided.winnerUid;
        deciders.push({ tie, decider });
      }

      if (!winnerUid) {
        throw new Error(`Tie ${tie.tieId} was not decided.`);
      }

      const winner = winnerUid === better.playerId ? better : worse;
      current = advanceBracket(current, { tieId: tie.tieId, winner });
      index += 1;
    }
  }

  return { bracket: current, deciders };
}

function slotSignature(slot: BracketSlot): string {
  const ref: KnockoutSlot = slot.ref;
  return ref.type === "seed"
    ? `seed:${ref.seed}:${slot.player?.playerId ?? "-"}`
    : `winner:${ref.tieId}:${slot.player?.playerId ?? "-"}`;
}

function bracketSignature(bracket: KnockoutBracket): string {
  return bracket.ties
    .map(
      (tie) =>
        `${tie.tieId}:${tie.round}:${tie.bracketSlot}:${slotSignature(tie.higher)}:${slotSignature(tie.lower)}`,
    )
    .join("|");
}

describe("home advantage", () => {
  it("gives the first leg to the lower-ranked player and the second to the higher", () => {
    const tie = resolvable();

    expect(homeUidForLeg(tie, 1)).toBe("p16");
    expect(awayUidForLeg(tie, 1)).toBe("p01");
    expect(homeUidForLeg(tie, 2)).toBe("p01");
    expect(awayUidForLeg(tie, 2)).toBe("p16");
  });

  it("lists the higher-ranked player first in a single match", () => {
    const tie = resolvable({ legs: 1 });

    expect(homeUidForLeg(tie, 1)).toBe("p01");
    expect(awayUidForLeg(tie, 1)).toBe("p16");
  });

  it("rejects a leg that does not exist", () => {
    expect(() => homeUidForLeg(resolvable(), 3)).toThrow();
    expect(() => homeUidForLeg(resolvable({ legs: 1 }), 2)).toThrow();
  });
});

describe("tie resolution", () => {
  it("is pending when no leg has a score", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", null, null, 1),
      match("p01", "p16", null, null, 2),
    ]);

    expect(resolution.status).toBe("pending");
    expect(resolution.legsPlayed).toBe(0);
    expect(resolution.winnerUid).toBeNull();
  });

  it("is in progress after one completed leg", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 1, 2, 1),
      match("p01", "p16", null, null, 2),
    ]);

    expect(resolution.status).toBe("in_progress");
    expect(resolution.legsPlayed).toBe(1);
  });

  it("aggregates a two-legged win regardless of venue", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 0, 1, 1),
      match("p01", "p16", 2, 0, 2),
    ]);

    expect(resolution.aggregate).toEqual({ higherGoals: 3, lowerGoals: 0 });
    expect(resolution.status).toBe("completed");
    expect(resolution.winnerUid).toBe("p01");
    expect(resolution.decidedBy).toBe("aggregate");
  });

  it("has no away-goals rule, so a level aggregate needs a decider", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 1, 0, 1),
      match("p01", "p16", 1, 0, 2),
    ]);

    expect(resolution.aggregate).toEqual({ higherGoals: 1, lowerGoals: 1 });
    expect(resolution.status).toBe("needs_decider");
    expect(resolution.decidedBy).toBeNull();
  });

  it("resolves a single-match tie", () => {
    const tie = resolvable({ legs: 1 });
    const resolution = resolveTie(tie, [match("p01", "p16", 2, 4, 1)]);

    expect(resolution.status).toBe("completed");
    expect(resolution.winnerUid).toBe("p16");
    expect(resolution.decidedBy).toBe("aggregate");
  });

  it("rejects a match played at the wrong venue", () => {
    expect(() => resolveTie(resolvable(), [match("p01", "p16", 1, 0, 1)])).toThrow(/home or away/);
  });

  it("rejects duplicate legs and half-entered scores", () => {
    expect(() =>
      resolveTie(resolvable(), [match("p16", "p01", 1, 0, 1), match("p16", "p01", 1, 0, 1)]),
    ).toThrow(/more than one leg/);

    expect(() => resolveTie(resolvable(), [match("p16", "p01", 1, null, 1)])).toThrow(
      /both scores or neither/,
    );
  });
});

describe("deciders", () => {
  it("accepts extra time for a level tie", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 1, 1, 1),
      match("p01", "p16", 0, 0, 2),
    ]);
    const decided = applyDecider(resolution, tie, {
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
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 0, 0, 1),
      match("p01", "p16", 0, 0, 2),
    ]);
    const decided = applyDecider(resolution, tie, {
      winnerUid: "p01",
      method: "penalties",
      note: null,
      penalties: { higher: 5, lower: 4 },
    });

    expect(decided.decidedBy).toBe("penalties");
    expect(decided.winnerUid).toBe("p01");

    expect(() =>
      applyDecider(resolution, tie, {
        winnerUid: "p16",
        method: "penalties",
        note: null,
        penalties: { higher: 5, lower: 4 },
      }),
    ).toThrow(/must agree/);

    expect(() =>
      applyDecider(resolution, tie, {
        winnerUid: "p01",
        method: "penalties",
        note: null,
        penalties: { higher: 4, lower: 4 },
      }),
    ).toThrow(/cannot be level/);
  });

  it("refuses a decider for a tie that is not level or not finished", () => {
    const tie = resolvable();
    const won = resolveTie(tie, [match("p16", "p01", 0, 1, 1), match("p01", "p16", 1, 0, 2)]);

    expect(() =>
      applyDecider(won, tie, {
        winnerUid: "p01",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/level on aggregate/);

    const pending = resolveTie(tie, []);
    expect(() =>
      applyDecider(pending, tie, {
        winnerUid: "p01",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/level on aggregate/);
  });

  it("refuses a winner who is not in the tie", () => {
    const tie = resolvable();
    const resolution = resolveTie(tie, [
      match("p16", "p01", 0, 0, 1),
      match("p01", "p16", 0, 0, 2),
    ]);

    expect(() =>
      applyDecider(resolution, tie, {
        winnerUid: "p99",
        method: "extra_time",
        note: null,
        penalties: null,
      }),
    ).toThrow(/two tied players/);
  });
});

describe("bracket construction", () => {
  it("builds all 23 ties in five rounds", () => {
    const bracket = bracketFor("draw-1");
    const counts = KNOCKOUT_ROUNDS.map((round) => ({
      round,
      ties: roundTies(bracket, round).length,
      expected: KNOCKOUT_ROUND_TIE_COUNTS[round],
    }));

    expect(bracket.ties).toHaveLength(23);
    expect(counts.every((entry) => entry.ties === entry.expected)).toBe(true);
    expect(validateBracket(bracket)).toEqual({ valid: true, issues: [] });
  });

  it("pairs each play-off group with one seeded and one unseeded player", () => {
    const bracket = bracketFor("draw-1");

    for (const group of PLAYOFF_GROUPS) {
      const ties = roundTies(bracket, "playoff").filter((tie) => tie.group === group);
      const definition = PLAYOFF_GROUP_SEEDS[group];

      expect(ties).toHaveLength(2);

      for (const tie of ties) {
        const positions = [requirePlayer(tie.higher).position, requirePlayer(tie.lower).position];

        expect(positions.filter((position) => definition.seeded.includes(position))).toHaveLength(
          1,
        );
        expect(positions.filter((position) => definition.unseeded.includes(position))).toHaveLength(
          1,
        );
      }
    }
  });

  it("feeds every direct qualifier the correct play-off group", () => {
    const bracket = bracketFor("draw-1");

    for (const tie of roundTies(bracket, "r16")) {
      const direct = requirePlayer(tie.higher);

      expect(direct.position).toBeLessThanOrEqual(8);
      expect(tie.higher.ref).toEqual({ type: "seed", seed: direct.position });

      const source = tie.lower.ref;

      expect(source.type).toBe("winnerOf");

      if (source.type === "winnerOf") {
        const sourceTie = bracket.ties.find((entry) => entry.tieId === source.tieId);
        expect(sourceTie?.group).toBe(R16_OPPONENT_GROUP[direct.position]);
      }
    }
  });

  it("makes the final a single match even when the draw uses two legs", () => {
    const bracket = bracketFor("draw-1", 2);

    expect(roundTies(bracket, "playoff").every((tie) => tie.legs === 2)).toBe(true);
    expect(roundTies(bracket, "r16").every((tie) => tie.legs === 2)).toBe(true);
    expect(roundTies(bracket, "qf").every((tie) => tie.legs === 2)).toBe(true);
    expect(roundTies(bracket, "sf").every((tie) => tie.legs === 2)).toBe(true);
    expect(roundTies(bracket, "final").map((tie) => tie.legs)).toEqual([1]);
  });

  it("is deterministic for a recorded seed and varies between seeds", () => {
    expect(bracketSignature(bracketFor("same-seed"))).toBe(
      bracketSignature(bracketFor("same-seed")),
    );

    const signatures = new Set(
      Array.from({ length: 20 }, (_, index) => bracketSignature(bracketFor(`seed-${index}`))),
    );

    expect(signatures.size).toBeGreaterThan(1);
  });

  it("rejects a missing player, duplicate position, duplicate player and an empty seed", () => {
    const missing = standings36().filter((player) => player.position !== 9);
    expect(() => buildKnockoutBracket({ standings: missing, seed: "draw-1" })).toThrow(
      /position 9/,
    );

    const duplicatePosition = [...standings36(), playerAt(9)];
    expect(() => buildKnockoutBracket({ standings: duplicatePosition, seed: "draw-1" })).toThrow(
      /more than once/,
    );

    const duplicatePlayer = standings36().map((player) =>
      player.position === 10 ? { ...player, playerId: "p09" } : player,
    );
    expect(() => buildKnockoutBracket({ standings: duplicatePlayer, seed: "draw-1" })).toThrow(
      /player p09/,
    );

    expect(() => buildKnockoutBracket({ standings: standings36(), seed: "  " })).toThrow(/seed/);
    expect(() =>
      buildKnockoutBracket({
        standings: standings36(),
        seed: "draw-1",
        legs: 3 as unknown as 1,
      }),
    ).toThrow(/one or two legs/);
  });
});

describe("2,000-seed bracket properties", () => {
  it("builds a valid, fully connected bracket and never meets seeds 1 and 2 before the final", () => {
    for (let index = 0; index < 2000; index += 1) {
      const bracket = bracketFor(`property-${index}`);

      expect(validateBracket(bracket)).toEqual({ valid: true, issues: [] });

      const ids = new Set(bracket.ties.map((tie) => tie.tieId));
      expect(ids.size).toBe(23);

      // Every winnerOf reference names a real, earlier-round tie.
      for (const tie of bracket.ties) {
        for (const current of [tie.higher, tie.lower]) {
          const ref = current.ref;

          if (ref.type === "winnerOf") {
            const source = bracket.ties.find((entry) => entry.tieId === ref.tieId);

            expect(source).toBeDefined();
            expect(KNOCKOUT_ROUNDS.indexOf(source?.round as KnockoutRound)).toBeLessThan(
              KNOCKOUT_ROUNDS.indexOf(tie.round),
            );
          }
        }
      }

      // Every player enters the first knockout round exactly once.
      const firstRound = roundTies(bracket, "playoff");
      const entered = firstRound.flatMap((tie) => [
        requirePlayer(tie.higher).playerId,
        requirePlayer(tie.lower).playerId,
      ]);
      expect(new Set(entered).size).toBe(16);
      expect([...entered].sort()).toEqual(
        standings36()
          .slice(8, 24)
          .map((player) => player.playerId)
          .sort(),
      );

      const seedOne = roundTies(bracket, "r16").find(
        (tie) => requirePlayer(tie.higher).position === 1,
      );
      const seedTwo = roundTies(bracket, "r16").find(
        (tie) => requirePlayer(tie.higher).position === 2,
      );

      expect(seedOne?.bracketSlot).toBeLessThanOrEqual(4);
      expect(seedTwo?.bracketSlot).toBeGreaterThanOrEqual(5);

      const semiOf = (tieId: string): string | undefined => {
        const sf = roundTies(bracket, "sf").find((tie) =>
          [tie.higher.ref, tie.lower.ref].some(
            (ref) => ref.type === "winnerOf" && ref.tieId === tieId,
          ),
        );

        if (sf) {
          return sf.tieId;
        }

        const qf = roundTies(bracket, "qf").find((tie) =>
          [tie.higher.ref, tie.lower.ref].some(
            (ref) => ref.type === "winnerOf" && ref.tieId === tieId,
          ),
        );

        return qf ? semiOf(qf.tieId) : undefined;
      };

      expect(semiOf(seedOne?.tieId as string)).not.toBe(semiOf(seedTwo?.tieId as string));
    }
  }, 30_000);
});

describe("500 complete bracket simulations", () => {
  for (const legs of [1, 2] as const) {
    it(`plays every tie to a champion with ${legs}-leg rounds`, () => {
      let deciderCount = 0;

      for (let index = 0; index < 500; index += 1) {
        const simulated = playBracket(bracketFor(`simulate-${legs}-${index}`, legs));
        deciderCount += simulated.deciders.length;

        const completed = simulated.bracket;

        expect(validateBracket(completed)).toEqual({ valid: true, issues: [] });
        expect(completed.ties.every((tie) => tie.winner !== null)).toBe(true);

        const champion = roundTies(completed, "final")[0]?.winner;

        expect(champion).not.toBeNull();
        expect(champion?.position).toBeGreaterThanOrEqual(1);
        expect(champion?.position).toBeLessThanOrEqual(36);

        if (legs === 1) {
          expect(completed.ties.every((tie) => tie.legs === 1)).toBe(true);
        } else {
          expect(roundTies(completed, "final")[0]?.legs).toBe(1);
        }

        // Every round after the first contains only previous-round winners.
        for (const round of KNOCKOUT_ROUNDS.slice(1)) {
          const participants = roundTies(completed, round).flatMap((tie) => [
            requirePlayer(tie.higher).playerId,
            requirePlayer(tie.lower).playerId,
          ]);

          expect(new Set(participants).size).toBe(participants.length);
        }

        const dependents = dependentTieIds(completed, "playoff-a1");
        expect(dependents.size).toBe(4);
        expect(dependents.has("final-1")).toBe(true);
        expect(dependents.has("playoff-a2")).toBe(false);
      }

      expect(deciderCount).toBeGreaterThan(0);
    }, 60_000);
  }
});

describe("draw fairness", () => {
  it("draws every play-off pairing within five percentage points of even", () => {
    const trials = 2000;
    const playoffPairings = new Map<string, number>();
    const r16Assignments = new Map<string, number>();

    for (let index = 0; index < trials; index += 1) {
      const bracket = bracketFor(`fairness-${index}`);

      for (const tie of roundTies(bracket, "playoff")) {
        const key = `${requirePlayer(tie.higher).position}:${requirePlayer(tie.lower).position}`;
        playoffPairings.set(key, (playoffPairings.get(key) ?? 0) + 1);
      }

      for (const tie of roundTies(bracket, "r16")) {
        const direct = requirePlayer(tie.higher).position;
        const ref = tie.lower.ref;
        const source = ref.type === "winnerOf" ? ref.tieId : "?";
        const key = `${direct}:${source}`;
        r16Assignments.set(key, (r16Assignments.get(key) ?? 0) + 1);
      }
    }

    // Every seeded player meets each unseeded player of its group about half the time.
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

    // Each direct seed meets each of the two group winners about half the time.
    for (let direct = 1; direct <= 8; direct += 1) {
      const counts = [...r16Assignments.entries()]
        .filter(([key]) => Number(key.split(":")[0]) === direct)
        .map(([, count]) => count);
      const total = counts.reduce((sum, count) => sum + count, 0);

      expect(counts).toHaveLength(2);
      expect(total).toBe(trials);

      for (const count of counts) {
        expect(Math.abs(count / total - 0.5)).toBeLessThanOrEqual(0.05);
      }
    }
  }, 30_000);
});

describe("bracket progression", () => {
  it("fills later rounds only after the feeding tie completes", () => {
    let bracket = bracketFor("progression-seed");
    const playoff = roundTies(bracket, "playoff")[0];

    expect(playoff).toBeDefined();
    expect(roundTies(bracket, "r16").every((tie) => tie.lower.player === null)).toBe(true);

    const higher = requirePlayer(playoff!.higher);
    bracket = advanceBracket(bracket, { tieId: playoff!.tieId, winner: higher });

    const r16 = roundTies(bracket, "r16").find((tie) => {
      const ref = tie.lower.ref;
      return ref.type === "winnerOf" && ref.tieId === playoff!.tieId;
    });

    expect(r16?.lower.player?.playerId).toBe(higher.playerId);
    expect(roundTies(bracket, "qf").every((tie) => tie.higher.player === null)).toBe(true);
  });

  it("clears dependent winners when a corrected result changes a participant", () => {
    const simulated = playBracket(bracketFor("correction-seed"));
    const completed = simulated.bracket;
    const playoff = roundTies(completed, "playoff")[0]!;
    const currentWinner = playoff.winner!;
    const other =
      requirePlayer(playoff.higher).playerId === currentWinner.playerId
        ? requirePlayer(playoff.lower)
        : requirePlayer(playoff.higher);

    const dependent = roundTies(completed, "r16").find((tie) => {
      const ref = tie.lower.ref;
      return ref.type === "winnerOf" && ref.tieId === playoff.tieId;
    });

    expect(dependent?.winner).not.toBeNull();

    const changed = advanceBracket(completed, { tieId: playoff.tieId, winner: other });
    const changedDependent = changed.ties.find((tie) => tie.tieId === dependent?.tieId);

    expect(changedDependent?.lower.player?.playerId).toBe(other.playerId);
    expect(changedDependent?.winner).toBeNull();
    expect(roundTies(changed, "final")[0]?.winner).toBeNull();
  });

  it("refuses a winner who is not one of the tie's participants", () => {
    const bracket = bracketFor("progression-seed");
    const playoff = roundTies(bracket, "playoff")[0]!;
    const outsider = standings36().find((player) => player.position === 1) as KnockoutPlayer;

    expect(() => advanceBracket(bracket, { tieId: playoff.tieId, winner: outsider })).toThrow(
      /no participant/,
    );
    expect(() => advanceBracket(bracket, { tieId: "missing-tie", winner: outsider })).toThrow(
      /does not exist/,
    );
  });
});

describe("independent validator", () => {
  it("catches missing and duplicate ties", () => {
    const bracket = bracketFor("mutation-seed");

    expect(
      validateBracket(
        withTies(
          bracket,
          bracket.ties.filter((tie) => tie.tieId !== "qf-1"),
        ),
      ).valid,
    ).toBe(false);
    expect(
      validateBracket(replaceTie(bracket, "qf-2", (tie) => ({ ...tie, tieId: "qf-1" }))).valid,
    ).toBe(false);
  });

  it("catches an invalid bracket slot, leg count and two-legged final", () => {
    const bracket = bracketFor("mutation-seed");

    expect(
      validateBracket(replaceTie(bracket, "qf-1", (tie) => ({ ...tie, bracketSlot: 9 }))).valid,
    ).toBe(false);
    expect(
      validateBracket(replaceTie(bracket, "qf-1", (tie) => ({ ...tie, legs: 3 as unknown as 1 })))
        .valid,
    ).toBe(false);
    expect(
      validateBracket(replaceTie(bracket, "final-1", (tie) => ({ ...tie, legs: 2 }))).valid,
    ).toBe(false);
  });

  it("catches a broken play-off pair and group", () => {
    const bracket = bracketFor("mutation-seed");
    const groupA = roundTies(bracket, "playoff").filter((tie) => tie.group === "A");
    const first = groupA[0]!;
    const second = groupA[1]!;

    expect(
      validateBracket(
        replaceTie(bracket, first.tieId, (tie) => ({
          ...tie,
          lower: { ...tie.lower, player: requirePlayer(second.higher) },
        })),
      ).valid,
    ).toBe(false);

    expect(
      validateBracket(replaceTie(bracket, "playoff-a1", (tie) => ({ ...tie, group: null }))).valid,
    ).toBe(false);
  });

  it("catches the wrong play-off group feeding a direct seed", () => {
    const bracket = bracketFor("mutation-seed");
    const r16 = roundTies(bracket, "r16")[0]!;
    const ref = r16.lower.ref;

    expect(ref.type).toBe("winnerOf");

    if (ref.type === "winnerOf") {
      const wrongSource = roundTies(bracket, "playoff").find(
        (tie) => tie.group !== bracket.ties.find((entry) => entry.tieId === ref.tieId)?.group,
      );

      expect(
        validateBracket(
          replaceTie(bracket, r16.tieId, (tie) => ({
            ...tie,
            lower: { ...tie.lower, ref: { type: "winnerOf", tieId: wrongSource?.tieId as string } },
          })),
        ).valid,
      ).toBe(false);
    }
  });

  it("catches seeds 1 and 2 on the same half", () => {
    const bracket = bracketFor("mutation-seed");
    const seedOne = roundTies(bracket, "r16").find(
      (tie) => requirePlayer(tie.higher).position === 1,
    )!;
    const seedTwo = roundTies(bracket, "r16").find(
      (tie) => requirePlayer(tie.higher).position === 2,
    )!;
    const swapped = bracket.ties.map((tie) => {
      if (tie.tieId === seedOne.tieId) {
        return { ...tie, bracketSlot: seedTwo.bracketSlot };
      }

      if (tie.tieId === seedTwo.tieId) {
        return { ...tie, bracketSlot: seedOne.bracketSlot };
      }

      return tie;
    });

    expect(validateBracket(withTies(bracket, swapped)).valid).toBe(false);
  });

  it("catches a reversed ranking and a winner outside the tie", () => {
    const simulated = playBracket(bracketFor("mutation-seed"));
    const completed = simulated.bracket;
    const r16 = roundTies(completed, "r16")[0]!;

    expect(
      validateBracket(
        replaceTie(completed, r16.tieId, (tie) => ({
          ...tie,
          higher: { ...tie.higher, player: tie.lower.player },
          lower: { ...tie.lower, player: tie.higher.player },
          winner: null,
        })),
      ).valid,
    ).toBe(false);

    const outsider = roundTies(completed, "r16")[1]!;
    expect(
      validateBracket(
        replaceTie(completed, r16.tieId, (tie) => ({
          ...tie,
          winner: requirePlayer(outsider.higher),
        })),
      ).valid,
    ).toBe(false);
  });

  it("catches a participant named before its source tie is decided", () => {
    const simulated = playBracket(bracketFor("mutation-seed"));
    const completed = simulated.bracket;
    const r16 = roundTies(completed, "r16")[0]!;

    expect(
      validateBracket(
        replaceTie(completed, r16.tieId, (tie) => ({
          ...tie,
          lower: { ...tie.lower, player: null },
          winner: null,
        })),
      ).valid,
    ).toBe(false);
  });
});
