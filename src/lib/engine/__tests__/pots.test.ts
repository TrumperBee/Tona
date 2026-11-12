import { describe, expect, it } from "vitest";

import {
  createEmptyPots,
  POT_PLAYER_TOTAL,
  PotAllocationError,
  shuffleIntoPots,
  validatePots,
  type PotNumber,
  type Pots,
} from "@/lib/engine/pots";

function players(count = POT_PLAYER_TOTAL): string[] {
  return Array.from({ length: count }, (_, index) => `player-${String(index).padStart(2, "0")}`);
}

function expectCode(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(PotAllocationError);
    expect((error as PotAllocationError).code).toBe(code);
    return;
  }

  throw new Error(`Expected a PotAllocationError with code ${code}.`);
}

function potsFrom(ids: readonly string[]): Pots {
  return {
    "1": ids.slice(0, 9),
    "2": ids.slice(9, 18),
    "3": ids.slice(18, 27),
    "4": ids.slice(27, 36),
  };
}

describe("shuffleIntoPots", () => {
  it("places exactly nine players in each of the four pots", () => {
    const ids = players();
    const allocation = shuffleIntoPots({ playerIds: ids, seed: "seed-one" });

    for (const key of ["1", "2", "3", "4"] as const) {
      expect(allocation.pots[key]).toHaveLength(9);
    }

    expect(
      [
        ...allocation.pots["1"],
        ...allocation.pots["2"],
        ...allocation.pots["3"],
        ...allocation.pots["4"],
      ].sort(),
    ).toEqual(ids);
    expect(allocation.unassigned).toEqual([]);
  });

  it("is deterministic: the same seed and field produce the same draw", () => {
    const ids = players();

    expect(shuffleIntoPots({ playerIds: ids, seed: "repeatable" })).toEqual(
      shuffleIntoPots({ playerIds: ids, seed: "repeatable" }),
    );
  });

  it("produces a different draw for a different seed", () => {
    const ids = players();

    expect(shuffleIntoPots({ playerIds: ids, seed: "seed-a" }).pots).not.toEqual(
      shuffleIntoPots({ playerIds: ids, seed: "seed-b" }).pots,
    );
  });

  it("keeps locked players in their pot while filling the remaining slots", () => {
    const ids = players();
    const locked: Record<string, PotNumber> = {
      "player-00": 1,
      "player-01": 1,
      "player-10": 2,
      "player-20": 3,
      "player-30": 4,
      "player-35": 4,
    };

    const { pots } = shuffleIntoPots({ playerIds: ids, locked, seed: "locked-draw" });

    expect(pots["1"].slice(0, 2)).toEqual(["player-00", "player-01"]);
    expect(pots["2"][0]).toBe("player-10");
    expect(pots["3"][0]).toBe("player-20");
    expect(pots["4"].slice(0, 2)).toEqual(["player-30", "player-35"]);

    for (const key of ["1", "2", "3", "4"] as const) {
      expect(pots[key]).toHaveLength(9);
    }
  });

  it("rejects a field that is not exactly 36 players", () => {
    expectCode(
      () => shuffleIntoPots({ playerIds: players(35), seed: "short" }),
      "invalid-player-count",
    );
    expectCode(
      () => shuffleIntoPots({ playerIds: players(37), seed: "long" }),
      "invalid-player-count",
    );
  });

  it("rejects duplicate players", () => {
    const ids = players();
    ids[35] = ids[0] as string;

    expectCode(() => shuffleIntoPots({ playerIds: ids, seed: "dupes" }), "duplicate-player");
  });

  it("rejects an empty seed", () => {
    expectCode(() => shuffleIntoPots({ playerIds: players(), seed: "" }), "invalid-seed");
  });

  it("rejects a lock for a player outside the field", () => {
    expectCode(
      () =>
        shuffleIntoPots({
          playerIds: players(),
          locked: { outsider: 1 },
          seed: "unknown-lock",
        }),
      "unknown-locked-player",
    );
  });

  it("rejects an invalid locked pot", () => {
    expectCode(
      () =>
        shuffleIntoPots({
          playerIds: players(),
          locked: { "player-00": 5 as PotNumber },
          seed: "bad-pot",
        }),
      "invalid-locked-pot",
    );
  });

  it("rejects more than nine locked players in one pot", () => {
    const ids = players();
    const locked: Record<string, PotNumber> = {};

    for (let index = 0; index < 10; index += 1) {
      locked[ids[index] as string] = 1;
    }

    expectCode(
      () => shuffleIntoPots({ playerIds: ids, locked, seed: "over-capacity" }),
      "pot-over-capacity",
    );
  });

  it("is uniform over many seeds: every player lands in every pot about 25% of the time", () => {
    const ids = players();
    const seeds = 4_000;
    const counts = new Map<string, [number, number, number, number]>();

    for (const uid of ids) {
      counts.set(uid, [0, 0, 0, 0]);
    }

    for (let index = 0; index < seeds; index += 1) {
      const { pots } = shuffleIntoPots({ playerIds: ids, seed: `uniform-${index}` });

      for (const [potIndex, key] of (["1", "2", "3", "4"] as const).entries()) {
        for (const uid of pots[key]) {
          const row = counts.get(uid) as [number, number, number, number];
          row[potIndex] += 1;
        }
      }
    }

    for (const [uid, row] of counts) {
      for (const [potIndex, count] of row.entries()) {
        const frequency = count / seeds;
        expect(frequency, `${uid} in pot ${potIndex + 1}`).toBeGreaterThanOrEqual(0.22);
        expect(frequency, `${uid} in pot ${potIndex + 1}`).toBeLessThanOrEqual(0.28);
      }
    }
  });
});

describe("validatePots", () => {
  it("accepts four pots of nine containing the whole registered field exactly once", () => {
    const ids = players();
    const { pots } = shuffleIntoPots({ playerIds: ids, seed: "valid" });

    expect(validatePots(pots, ids)).toEqual({ valid: true, issues: [] });
  });

  it("accepts numeric pot keys from an in-memory caller", () => {
    const ids = players();
    const pots = potsFrom(ids) as unknown as Record<string, readonly string[]>;

    expect(
      validatePots({ 1: pots["1"], 2: pots["2"], 3: pots["3"], 4: pots["4"] }, ids).valid,
    ).toBe(true);
  });

  it("rejects a registered field that is not exactly 36 unique players", () => {
    const ids = players();
    const { pots } = shuffleIntoPots({ playerIds: ids, seed: "counts" });

    expect(validatePots(pots, ids.slice(0, 35)).issues[0]?.code).toBe("invalid-registered-players");

    const duplicate = [...ids.slice(0, 35), ids[0] as string];
    expect(validatePots(pots, duplicate).issues[0]?.code).toBe("duplicate-registered-player");
  });

  it("rejects a draw that is not an object of four pots", () => {
    const ids = players();

    expect(validatePots(null, ids).issues[0]?.code).toBe("invalid-pots");
    expect(validatePots({ "1": [], "2": [] }, ids).issues[0]?.code).toBe("invalid-pots");

    const emptyDraw = validatePots(createEmptyPots(), ids);

    expect(emptyDraw.valid).toBe(false);
    expect(emptyDraw.issues.some((issue) => issue.code === "pot-size")).toBe(true);
  });

  it("rejects wrong pot sizes", () => {
    const ids = players();
    const pots = potsFrom(ids) as unknown as Record<string, string[]>;
    pots["1"] = [...(pots["1"] as string[]), ...(pots["2"] as string[]).slice(0, 1)];
    pots["2"] = (pots["2"] as string[]).slice(1);

    expect(validatePots(pots, ids).issues.some((issue) => issue.code === "pot-size")).toBe(true);
  });

  it("rejects a player who appears twice", () => {
    const ids = players();
    const pots = potsFrom(ids) as unknown as Record<string, string[]>;
    pots["2"][0] = pots["1"][0] as string;

    const result = validatePots(pots, ids);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "duplicate-player")).toBe(true);
  });

  it("rejects an unregistered player and a missing registered player", () => {
    const ids = players();
    const pots = potsFrom(ids) as unknown as Record<string, string[]>;
    pots["1"][0] = "outsider";

    const result = validatePots(pots, ids);

    expect(result.issues.some((issue) => issue.code === "unknown-player")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "missing-player")).toBe(true);
  });
});
