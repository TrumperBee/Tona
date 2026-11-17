// GCC - deterministic graphic file names.
import { describe, expect, it } from "vitest";

import { fileNameSlug, graphicFileName, stableGraphicHash } from "@/lib/graphics/filename";
import type { ChampionGraphicData } from "@/lib/graphics/types";

const champion: ChampionGraphicData = {
  champion: { uid: "u1", gamerTag: "Nairobi Storm", avatarUrl: null },
  runnerUp: null,
  finalScore: "2–1",
  scoreNote: null,
  championRecord: null,
};

describe("stableGraphicHash", () => {
  it("is an eight-character hex string", () => {
    expect(stableGraphicHash({ template: "champion" })).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns the same hash for the same payload", () => {
    expect(stableGraphicHash(champion)).toBe(stableGraphicHash(structuredClone(champion)));
  });

  it("changes when the payload changes", () => {
    expect(stableGraphicHash(champion)).not.toBe(
      stableGraphicHash({ ...champion, finalScore: "3–1" }),
    );
  });
});

describe("fileNameSlug", () => {
  it("lower-cases and hyphenates a tournament name", () => {
    expect(fileNameSlug("GCC Invitational — Season 2")).toBe("gcc-invitational-season-2");
  });

  it("strips accents and collapses punctuation", () => {
    expect(fileNameSlug("Café  Élite__Cup")).toBe("cafe-elite-cup");
  });

  it("falls back to tournament when nothing usable remains", () => {
    expect(fileNameSlug("—")).toBe("tournament");
  });
});

describe("graphicFileName", () => {
  it("follows gcc-{slug}-{template}-{hash}.png", () => {
    const name = graphicFileName("champion", "GCC Invitational", champion, "story");

    expect(name).toMatch(/^gcc-gcc-invitational-champion-[0-9a-f]{8}\.png$/);
  });

  it("uses the template file token rather than its id", () => {
    const name = graphicFileName("league-table", "season-one", champion, "story");

    expect(name).toContain("-table-");
    expect(name).not.toContain("-league-table-");
  });

  it("changes with the size even when the data is identical", () => {
    const story = graphicFileName("champion", "season-one", champion, "story");
    const square = graphicFileName("champion", "season-one", champion, "square");

    expect(story).not.toBe(square);
  });
});
