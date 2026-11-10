import { describe, expect, it } from "vitest";

import {
  organiserProfileEditSchema,
  organiserProfileLinkSchema,
} from "@/lib/validation/organiser-profile";

describe("organiserProfileLinkSchema", () => {
  it("accepts a labelled https link", () => {
    const parsed = organiserProfileLinkSchema.safeParse({
      label: "Community Discord",
      url: "https://discord.gg/example",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects non-https and malformed URLs", () => {
    expect(
      organiserProfileLinkSchema.safeParse({ label: "Site", url: "http://example.com" }).success,
    ).toBe(false);
    expect(organiserProfileLinkSchema.safeParse({ label: "Site", url: "not a url" }).success).toBe(
      false,
    );
    expect(
      organiserProfileLinkSchema.safeParse({ label: "Site", url: "https://example.com" }).success,
    ).toBe(true);
  });

  it("requires a non-empty label within the limit", () => {
    expect(organiserProfileLinkSchema.safeParse({ label: "", url: "https://a.dev" }).success).toBe(
      false,
    );

    expect(
      organiserProfileLinkSchema.safeParse({
        label: "x".repeat(41),
        url: "https://a.dev",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys inside a link", () => {
    expect(
      organiserProfileLinkSchema.safeParse({
        label: "Site",
        url: "https://a.dev",
        tracked: true,
      }).success,
    ).toBe(false);
  });
});

describe("organiserProfileEditSchema", () => {
  it("accepts a complete valid profile", () => {
    const parsed = organiserProfileEditSchema.safeParse({
      organisationName: "Nairobi eFootball League",
      bio: "Running weekly eFootball competitions since 2024.",
      links: [{ label: "Community", url: "https://example.com/community" }],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty bio and turns blank strings into null", () => {
    const parsed = organiserProfileEditSchema.parse({
      organisationName: "Coast Gamers",
      bio: "   ",
      links: [],
    });

    expect(parsed.bio).toBeNull();
    expect(parsed.links).toEqual([]);
  });

  it("keeps bio optional", () => {
    const parsed = organiserProfileEditSchema.parse({ organisationName: "Coast Gamers" });

    expect(parsed.bio).toBeUndefined();
    expect(parsed.links).toBeUndefined();
  });

  it("rejects organisation names outside 2-60 characters", () => {
    expect(organiserProfileEditSchema.safeParse({ organisationName: "A" }).success).toBe(false);
    expect(organiserProfileEditSchema.safeParse({ organisationName: "x".repeat(61) }).success).toBe(
      false,
    );
  });

  it("rejects a bio longer than 300 characters", () => {
    const parsed = organiserProfileEditSchema.safeParse({
      organisationName: "Valid Name",
      bio: "x".repeat(301),
    });

    expect(parsed.success).toBe(false);
  });

  it("allows at most three links", () => {
    const links = [1, 2, 3, 4].map((index) => ({
      label: `Link ${index}`,
      url: `https://example.com/${index}`,
    }));

    expect(organiserProfileEditSchema.safeParse({ organisationName: "Valid", links }).success).toBe(
      false,
    );

    expect(
      organiserProfileEditSchema.safeParse({ organisationName: "Valid", links: links.slice(0, 3) })
        .success,
    ).toBe(true);
  });

  it("rejects unknown top-level keys", () => {
    const parsed = organiserProfileEditSchema.safeParse({
      organisationName: "Valid Name",
      uid: "attacker-uid",
    });

    expect(parsed.success).toBe(false);
  });
});
