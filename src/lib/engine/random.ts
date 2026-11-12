// GCC - seeded, deterministic pseudo-random numbers for the competition engine.
//
// PURE TypeScript: no Firebase, no Node crypto, no browser globals and never
// `Math.random`. A draw records its seed string; replaying the same seed against
// the same input reproduces the same order exactly, which is what makes a random
// allocation auditable afterwards.
//
// The seed is expanded with cyrb128 into four 32-bit words and the first word
// drives a mulberry32 generator. `nextInt` uses rejection sampling so every
// value in `[0, maxExclusive)` is equally likely regardless of the modulus.
const UINT32_RANGE = 0x1_0000_0000;

export interface SeededRandom {
  /** Next uniformly distributed 32-bit unsigned integer. */
  nextUint32(): number;
  /** Next uniformly distributed integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number;
  /** Fisher-Yates shuffle; returns a new array and never mutates the input. */
  shuffle<T>(values: readonly T[]): T[];
}

/** Expands an arbitrary string into four 32-bit hash words (cyrb128). */
export function hashSeed(seed: string): readonly [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

/**
 * Derives a stable sub-seed for one purpose (for example "fixtures" or
 * "tiebreak"). Different labels never produce the same derived seed by
 * accident because the label is separated from the parent by a NUL byte.
 */
export function deriveSeed(seed: string, label: string): string {
  return hashSeed(`${seed}\u0000${label}`).map(toHex).join("");
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
}

/**
 * Creates a deterministic generator for one seed. The seed must be a non-empty
 * string; an empty seed is a programming error, not a random draw.
 */
export function createSeededRandom(seed: string): SeededRandom {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new TypeError("A random draw needs a non-empty seed string.");
  }

  const [firstWord] = hashSeed(seed);
  const next = mulberry32(firstWord);

  function nextUint32(): number {
    return next();
  }

  function nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("nextInt(maxExclusive) needs a positive integer bound.");
    }

    // Rejection sampling keeps the distribution exactly uniform instead of
    // biasing the first `2^32 mod maxExclusive` values.
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    let value = nextUint32();

    while (value >= limit) {
      value = nextUint32();
    }

    return value % maxExclusive;
  }

  function shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapWith = nextInt(index + 1);
      const current = result[index];
      result[index] = result[swapWith] as T;
      result[swapWith] = current as T;
    }

    return result;
  }

  return { nextUint32, nextInt, shuffle };
}
