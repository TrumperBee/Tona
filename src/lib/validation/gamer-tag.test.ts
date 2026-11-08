// GCC - gamer tag rule tests.
import { describe, expect, it } from "vitest";

import {
  GAMER_TAG_HINT,
  gamerTagKeySchema,
  gamerTagSchema,
  normalizeGamerTag,
  validateGamerTag,
} from "@/lib/validation/gamer-tag";

describe("validateGamerTag", () => {
  it("accepts tags that start and end alphanumerically", () => {
    for (const tag of ["abc", "messi10", "A_B", "a.b-c", "Player_01.x", "abcdefghijklmnop"]) {
      expect(validateGamerTag(tag), tag).toBeNull();
    }
  });

  it("rejects tags shorter than three or longer than sixteen characters", () => {
    expect(validateGamerTag("ab")).toBe(GAMER_TAG_HINT);
    expect(validateGamerTag("abcdefghijklmnopq")).toBe(GAMER_TAG_HINT);
  });

  it("rejects tags that start or end with a special character", () => {
    for (const tag of ["_abc", ".abc", "-abc", "abc_", "abc.", "abc-"]) {
      expect(validateGamerTag(tag), tag).toBe(GAMER_TAG_HINT);
    }
  });

  it("rejects consecutive special characters", () => {
    for (const tag of ["a..b", "a__b", "a--b", "ab._", "ab-.c"]) {
      expect(validateGamerTag(tag), tag).toBe(GAMER_TAG_HINT);
    }
  });

  it("rejects whitespace and characters outside the allowed set", () => {
    for (const tag of ["a b", "abc!", "café", "ab@c", "ab/c", "ab+c"]) {
      expect(validateGamerTag(tag), tag).toBe(GAMER_TAG_HINT);
    }
  });

  it("reports reserved words with their own message", () => {
    expect(validateGamerTag("Admin")).toBe("That gamer tag is reserved. Choose another.");
  });
});

describe("normalizeGamerTag", () => {
  it("trims and lowercases the uniqueness key", () => {
    expect(normalizeGamerTag("  MeSsI10  ")).toBe("messi10");
    expect(normalizeGamerTag("A.B_C-1")).toBe("a.b_c-1");
  });
});

describe("gamerTagSchema", () => {
  it("trims accepted display tags", () => {
    expect(gamerTagSchema.parse("  Striker_9  ")).toBe("Striker_9");
  });

  it("rejects reserved tags", () => {
    expect(gamerTagSchema.safeParse("Support").success).toBe(false);
  });
});

describe("gamerTagKeySchema", () => {
  it("returns the lowercase reservation key", () => {
    expect(gamerTagKeySchema.parse("  Striker_9 ")).toBe("striker_9");
  });
});
