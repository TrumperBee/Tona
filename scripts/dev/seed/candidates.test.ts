// GCC - unit tests for the deterministic fake-player data.
import { describe, expect, it } from "vitest";

import { getGamePlatforms } from "@/lib/config/games";
import { validateGamerTag } from "@/lib/validation/gamer-tag";
import { E164_PATTERN } from "@/lib/whatsapp/phone";

import {
  chooseCountry,
  choosePlatform,
  dramaPhone,
  registrationInputFor,
  SEED_CANDIDATES,
} from "./candidates";
import { testEmail } from "./manifest";

describe("seed candidates", () => {
  it("provides at least 36 candidates for the 36-account cap", () => {
    expect(SEED_CANDIDATES.length).toBeGreaterThanOrEqual(36);
    expect(new Set(SEED_CANDIDATES.map((candidate) => candidate.slot)).size).toBe(
      SEED_CANDIDATES.length,
    );
  });

  it("uses only valid, unique gamer tags that are not reserved", () => {
    const lower = SEED_CANDIDATES.map((candidate) => candidate.gamerTag.toLowerCase());

    for (const candidate of SEED_CANDIDATES) {
      expect(validateGamerTag(candidate.gamerTag)).toBeNull();
    }

    expect(new Set(lower).size).toBe(lower.length);
  });

  it("covers the UI edge lengths: 3, 16 and digit-prefixed tags", () => {
    const lengths = new Set(SEED_CANDIDATES.map((candidate) => candidate.gamerTag.length));

    expect(lengths.has(3)).toBe(true);
    expect(lengths.has(16)).toBe(true);
    expect(SEED_CANDIDATES.some((candidate) => /^\d/.test(candidate.gamerTag))).toBe(true);
    expect(SEED_CANDIDATES.some((candidate) => /[._-]/.test(candidate.gamerTag))).toBe(true);
    expect(SEED_CANDIDATES.some((candidate) => /[a-z]/.test(candidate.gamerTag))).toBe(true);
    expect(SEED_CANDIDATES.some((candidate) => /[A-Z]/.test(candidate.gamerTag))).toBe(true);
  });

  it("keeps the Kenyan majority near half the pool and varies other countries", () => {
    const kenyan = SEED_CANDIDATES.filter((candidate) => candidate.country === "KE").length;
    const countries = new Set(SEED_CANDIDATES.map((candidate) => candidate.country));
    const ratio = kenyan / SEED_CANDIDATES.length;

    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.7);
    expect(countries.size).toBeGreaterThanOrEqual(6);
  });

  it("uses a platform its preferred game actually supports", () => {
    for (const candidate of SEED_CANDIDATES) {
      expect(getGamePlatforms(candidate.preferredGame)).toContain(candidate.platform);
    }
  });

  it("uses deterministic reserved UK drama WhatsApp numbers in E.164", () => {
    for (const candidate of SEED_CANDIDATES) {
      const phone = dramaPhone(candidate.slot);

      expect(phone).toMatch(E164_PATTERN);
      expect(phone).toMatch(/^\+447700900\d{3}$/);
    }
  });

  it("builds the production registration payload with a test email", () => {
    const candidate = SEED_CANDIDATES[0]!;
    const input = registrationInputFor(
      candidate,
      { gameId: "efootball", allowedPlatforms: null, allowedCountries: null },
      "batch-password-123",
      testEmail(candidate.slot),
    );

    expect(input).toMatchObject({
      fullName: candidate.fullName,
      gamerTag: candidate.gamerTag,
      email: testEmail(candidate.slot),
      password: "batch-password-123",
      whatsapp: undefined,
      country: candidate.country,
      preferredGame: candidate.preferredGame,
      platform: candidate.platform,
      acceptTerms: true,
    });
    expect(input.email.endsWith("@gcc-test.example")).toBe(true);
  });

  it("respects country and platform restrictions", () => {
    const candidate = SEED_CANDIDATES.find((entry) => entry.preferredGame === "efootball")!;

    expect(
      chooseCountry(candidate, {
        gameId: "efootball",
        allowedPlatforms: null,
        allowedCountries: ["NG"],
      }),
    ).toBe("NG");
    expect(
      choosePlatform(candidate, {
        gameId: "efootball",
        allowedPlatforms: ["pc"],
        allowedCountries: null,
      }),
    ).toBe("pc");
  });

  it("refuses a restriction that no supported platform satisfies", () => {
    const dreamLeague = SEED_CANDIDATES.find(
      (entry) => entry.preferredGame === "dream-league-soccer",
    )!;

    expect(() =>
      choosePlatform(dreamLeague, {
        gameId: "dream-league-soccer",
        allowedPlatforms: ["xbox"],
        allowedCountries: null,
      }),
    ).toThrow(/does not support/);
  });
});
