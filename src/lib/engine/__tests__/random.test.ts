import { describe, expect, it } from "vitest";

import { createSeededRandom, deriveSeed, hashSeed } from "@/lib/engine/random";

describe("createSeededRandom", () => {
  it("produces identical sequences for the same seed", () => {
    const first = createSeededRandom("draw-seed-2026");
    const second = createSeededRandom("draw-seed-2026");

    const firstSequence = Array.from({ length: 50 }, () => first.nextUint32());
    const secondSequence = Array.from({ length: 50 }, () => second.nextUint32());

    expect(firstSequence).toEqual(secondSequence);
  });

  it("produces a different sequence for a different seed", () => {
    const first = createSeededRandom("draw-seed-a");
    const second = createSeededRandom("draw-seed-b");

    expect(Array.from({ length: 20 }, () => first.nextUint32())).not.toEqual(
      Array.from({ length: 20 }, () => second.nextUint32()),
    );
  });

  it("returns nextInt values inside the requested bound", () => {
    const random = createSeededRandom("bounds");

    for (const bound of [1, 2, 4, 9, 36, 1000]) {
      for (let index = 0; index < 200; index += 1) {
        const value = random.nextInt(bound);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(bound);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it("rejects non-positive and non-integer bounds", () => {
    const random = createSeededRandom("bad-bounds");

    expect(() => random.nextInt(0)).toThrow(RangeError);
    expect(() => random.nextInt(-1)).toThrow(RangeError);
    expect(() => random.nextInt(1.5)).toThrow(RangeError);
  });

  it("rejects an empty seed", () => {
    expect(() => createSeededRandom("")).toThrow(TypeError);
  });

  it("shuffles without mutating and keeps every item", () => {
    const input = Array.from({ length: 36 }, (_, index) => `p${index}`);
    const random = createSeededRandom("shuffle");

    const shuffled = random.shuffle(input);

    expect(input).toEqual(Array.from({ length: 36 }, (_, index) => `p${index}`));
    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort()).toEqual([...input].sort());
    expect(shuffled).not.toEqual(input);
  });
});

describe("deriveSeed", () => {
  it("is deterministic and depends on both the parent seed and the label", () => {
    expect(deriveSeed("parent", "fixtures")).toBe(deriveSeed("parent", "fixtures"));
    expect(deriveSeed("parent", "fixtures")).not.toBe(deriveSeed("parent", "tiebreak"));
    expect(deriveSeed("parent", "fixtures")).not.toBe(deriveSeed("other", "fixtures"));
  });

  it("returns a stable 128-bit hexadecimal value", () => {
    expect(deriveSeed("parent", "fixtures")).toMatch(/^[0-9a-f]{32}$/);
    expect(hashSeed("parent")).toHaveLength(4);
  });
});
