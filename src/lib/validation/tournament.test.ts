// GCC — unit tests for the Phase 8 tournament input schemas.
import { describe, expect, it } from "vitest";

import {
  maxStartsAtFrom,
  normaliseEntryRestrictions,
  playerRemovalReasonSchema,
  tournamentBasicsSchema,
  tournamentCancelReasonSchema,
  tournamentUpdateSchema,
  validatePublishCompleteness,
  validateStartsAtHorizon,
  validateTournamentDates,
} from "@/lib/validation/tournament";
import { slugCandidates, suggestTournamentSlug } from "@/lib/utils/slug";

const now = new Date("2026-06-01T12:00:00Z");
const day = (offset: number): Date => new Date(now.getTime() + offset * 86_400_000);

describe("tournamentBasicsSchema", () => {
  it("accepts the step 1 payload and trims text", () => {
    const parsed = tournamentBasicsSchema.parse({
      name: "  Nairobi Champions Cup  ",
      season: "2026/27",
      gameId: "efootball",
      description: "  The flagship Nairobi competition.  ",
    });

    expect(parsed).toEqual({
      name: "Nairobi Champions Cup",
      season: "2026/27",
      gameId: "efootball",
      description: "The flagship Nairobi competition.",
    });
  });

  it("rejects short names, bad games, long descriptions and unknown keys", () => {
    expect(
      tournamentBasicsSchema.safeParse({
        name: "No",
        season: "2026/27",
        gameId: "efootball",
        description: "x",
      }).success,
    ).toBe(false);

    expect(
      tournamentBasicsSchema.safeParse({
        name: "Valid Cup",
        season: "2026/27",
        gameId: "fifa",
        description: "x",
      }).success,
    ).toBe(false);

    expect(
      tournamentBasicsSchema.safeParse({
        name: "Valid Cup",
        season: "2026/27",
        gameId: "efootball",
        description: "x".repeat(1001),
      }).success,
    ).toBe(false);

    expect(
      tournamentBasicsSchema.safeParse({
        name: "Valid Cup",
        season: "2026/27",
        gameId: "efootball",
        description: "x",
        ownerUid: "attacker-controlled",
      }).success,
    ).toBe(false);
  });
});

describe("tournamentUpdateSchema", () => {
  it("rejects an empty patch and unknown fields", () => {
    expect(tournamentUpdateSchema.safeParse({}).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ status: "cancelled" }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ slug: "new-slug" }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ maxParticipants: 8 }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ registrationCount: 40 }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ formatId: "other" }).success).toBe(false);
  });

  it("caps the rules text at 4000 characters", () => {
    expect(tournamentUpdateSchema.safeParse({ rules: "x".repeat(4000) }).success).toBe(true);
    expect(tournamentUpdateSchema.safeParse({ rules: "x".repeat(4001) }).success).toBe(false);
  });

  it("accepts only whitelisted match durations", () => {
    expect(tournamentUpdateSchema.safeParse({ matchDurationMinutes: 10 }).success).toBe(true);
    expect(tournamentUpdateSchema.safeParse({ matchDurationMinutes: 90 }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ matchDurationMinutes: 7 }).success).toBe(false);
  });

  it("requires https image URLs", () => {
    expect(
      tournamentUpdateSchema.safeParse({ coverImageUrl: "https://res.example/x.jpg" }).success,
    ).toBe(true);
    expect(
      tournamentUpdateSchema.safeParse({ coverImageUrl: "http://res.example/x.jpg" }).success,
    ).toBe(false);
  });

  it("rejects duplicate platforms and countries", () => {
    expect(tournamentUpdateSchema.safeParse({ allowedPlatforms: ["pc", "pc"] }).success).toBe(
      false,
    );
    expect(tournamentUpdateSchema.safeParse({ allowedCountries: ["KE", "ke"] }).success).toBe(
      false,
    );
    expect(tournamentUpdateSchema.safeParse({ allowedCountries: ["KE", "NG"] }).success).toBe(true);
  });
});

describe("date validation", () => {
  it("orders the registration window before the start", () => {
    expect(
      validateTournamentDates({
        registrationOpensAt: day(0),
        registrationClosesAt: day(10),
        startsAt: day(11),
      }),
    ).toEqual({});

    expect(
      validateTournamentDates({
        registrationOpensAt: day(10),
        registrationClosesAt: day(10),
        startsAt: day(11),
      }).registrationClosesAt,
    ).toContain("after it opens");

    expect(
      validateTournamentDates({
        registrationOpensAt: day(0),
        registrationClosesAt: day(10),
        startsAt: day(9),
      }).startsAt,
    ).toContain("before registration closes");
  });

  it("allows the start exactly at the closing moment", () => {
    expect(
      validateTournamentDates({
        registrationOpensAt: day(0),
        registrationClosesAt: day(10),
        startsAt: day(10),
      }),
    ).toEqual({});
  });

  it("bounds the start to 18 months ahead", () => {
    expect(validateStartsAtHorizon(day(540), now)).toBeNull();
    expect(validateStartsAtHorizon(day(600), now)).toContain("18 months");
    // Exactly at the horizon is fine.
    expect(validateStartsAtHorizon(maxStartsAtFrom(now), now)).toBeNull();
  });

  it("requires description, rules and dates for publishing", () => {
    expect(
      validatePublishCompleteness({
        description: "Real description.",
        rules: "Real rules.",
        registrationOpensAt: day(0),
        registrationClosesAt: day(10),
        startsAt: day(11),
      }),
    ).toEqual({});

    expect(
      validatePublishCompleteness({
        description: "",
        rules: "",
        registrationOpensAt: day(0),
        registrationClosesAt: day(10),
        startsAt: day(11),
      }).rules,
    ).toContain("rules");
  });
});

describe("reason schemas", () => {
  it("requires a real cancellation reason", () => {
    expect(tournamentCancelReasonSchema.safeParse("too short").success).toBe(false);
    expect(tournamentCancelReasonSchema.safeParse("   ").success).toBe(false);
    expect(
      tournamentCancelReasonSchema.safeParse("Not enough teams could commit to the schedule.")
        .success,
    ).toBe(true);
  });

  it("bounds removal reasons to 5-300 characters", () => {
    expect(playerRemovalReasonSchema.safeParse("nope").success).toBe(false);
    expect(playerRemovalReasonSchema.safeParse("x".repeat(301)).success).toBe(false);
    expect(
      playerRemovalReasonSchema.safeParse("Repeated no-shows for scheduled matches.").success,
    ).toBe(true);
  });
});

describe("normaliseEntryRestrictions", () => {
  it("stores null when every platform is allowed", () => {
    const result = normaliseEntryRestrictions({
      allowedPlatforms: ["android", "ios", "pc", "playstation", "xbox"],
      allowedCountries: [],
    });

    expect(result.allowedPlatforms).toBeNull();
    expect(result.allowedCountries).toBeNull();
  });

  it("keeps partial platform restrictions", () => {
    const result = normaliseEntryRestrictions({ allowedPlatforms: ["pc", "xbox"] });
    expect(result.allowedPlatforms).toEqual(["pc", "xbox"]);
  });

  it("keeps country restrictions and treats empty as everyone", () => {
    expect(normaliseEntryRestrictions({ allowedCountries: ["KE", "TZ"] }).allowedCountries).toEqual(
      ["KE", "TZ"],
    );
    expect(normaliseEntryRestrictions({ allowedCountries: [] }).allowedCountries).toBeNull();
    expect(normaliseEntryRestrictions({}).allowedPlatforms).toBeNull();
  });
});

describe("slug generation", () => {
  it("builds the base slug from name and season", () => {
    expect(suggestTournamentSlug("Nairobi Cup", "2026/27")).toBe("nairobi-cup-2026-27");
    expect(suggestTournamentSlug("Thika Open!", "Season 1")).toBe("thika-open-season-1");
    expect(suggestTournamentSlug("Ünïcödé Çup", "2026")).toBe("unicode-cup-2026");
  });

  it("falls back when the combined text has no usable characters", () => {
    expect(suggestTournamentSlug("!!!", "???")).toBe("tournament");
  });

  it("offers numeric suffix candidates without repeating one", () => {
    expect(slugCandidates("nairobi-cup-2026-27", 5)).toEqual([
      "nairobi-cup-2026-27",
      "nairobi-cup-2026-27-2",
      "nairobi-cup-2026-27-3",
      "nairobi-cup-2026-27-4",
      "nairobi-cup-2026-27-5",
    ]);
  });
});
