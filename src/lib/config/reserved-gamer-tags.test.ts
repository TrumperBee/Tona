// GCC - reserved gamer tag tests.
import { describe, expect, it } from "vitest";

import { isReservedGamerTag, RESERVED_GAMER_TAGS } from "@/lib/config/reserved-gamer-tags";

describe("isReservedGamerTag", () => {
  it("matches reserved words case-insensitively", () => {
    for (const tag of ["admin", "ADMIN", "Admin", "gcc", "GcC", "super_admin", "Help"]) {
      expect(isReservedGamerTag(tag), tag).toBe(true);
    }
  });

  it("ignores surrounding whitespace", () => {
    expect(isReservedGamerTag("  support  ")).toBe(true);
  });

  it("does not reserve words that merely contain a reserved prefix", () => {
    for (const tag of ["admin1", "gccfc", "helpful", "moddy", "rooted"]) {
      expect(isReservedGamerTag(tag), tag).toBe(false);
    }
  });

  it("does not reserve ordinary gamer tags", () => {
    expect(isReservedGamerTag("striker_9")).toBe(false);
    expect(isReservedGamerTag("messi10")).toBe(false);
  });

  it("keeps the list unique and lowercase", () => {
    const lowered = RESERVED_GAMER_TAGS.map((tag) => tag.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
    expect(lowered.every((tag) => tag === tag.toLowerCase())).toBe(true);
  });
});
