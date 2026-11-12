// GCC - unit tests for the tournament editable-fields matrix.
import { describe, expect, it } from "vitest";

import {
  checkRegistrationClosesAtChange,
  checkStartsAtChange,
  filterTournamentPatch,
  getEditableTournamentFields,
  TOURNAMENT_FIELD_IDS,
} from "@/lib/tournament/editable-fields";

const now = new Date("2026-06-01T12:00:00Z");
const later = new Date("2026-07-01T12:00:00Z");
const earlier = new Date("2026-05-01T12:00:00Z");

describe("getEditableTournamentFields", () => {
  it("allows everything except format-level fields while in draft", () => {
    const editable = getEditableTournamentFields({ status: "draft", registrationCount: 5 });

    // Drafts are never registered into, but the matrix still allows edits.
    expect([...editable].sort()).toEqual([...TOURNAMENT_FIELD_IDS].sort());
  });

  it("locks name, game and season once any registration exists", () => {
    for (const status of ["registration_open", "registration_closed", "league_phase"] as const) {
      const editable = getEditableTournamentFields({ status, registrationCount: 1 });

      expect(editable.has("name")).toBe(false);
      expect(editable.has("gameId")).toBe(false);
      expect(editable.has("season")).toBe(false);
      expect(editable.has("description")).toBe(true);
    }
  });

  it("allows name, game and season after publish while nobody has registered", () => {
    const editable = getEditableTournamentFields({
      status: "registration_open",
      registrationCount: 0,
    });

    expect(editable.has("name")).toBe(true);
    expect(editable.has("season")).toBe(true);
    expect(editable.has("gameId")).toBe(true);
    expect(editable.has("allowedPlatforms")).toBe(true);
    expect(editable.has("allowedCountries")).toBe(true);
  });

  it("locks entry restrictions after publish once a registration exists", () => {
    const editable = getEditableTournamentFields({
      status: "registration_open",
      registrationCount: 1,
    });

    expect(editable.has("allowedPlatforms")).toBe(false);
    expect(editable.has("allowedCountries")).toBe(false);
  });

  it("always allows description, rules, branding and the two schedule fields after publish", () => {
    const editable = getEditableTournamentFields({
      status: "registration_closed",
      registrationCount: 36,
    });

    for (const field of [
      "description",
      "rules",
      "coverImageUrl",
      "logoUrl",
      "registrationClosesAt",
      "startsAt",
    ] as const) {
      expect(editable.has(field)).toBe(true);
    }
  });

  it("locks timezone and match duration after publish", () => {
    const editable = getEditableTournamentFields({
      status: "registration_open",
      registrationCount: 0,
    });

    expect(editable.has("timezone")).toBe(false);
    expect(editable.has("matchDurationMinutes")).toBe(false);
    expect(editable.has("registrationOpensAt")).toBe(false);
  });

  it("allows the tie-break profile until the first league result is recorded", () => {
    for (const status of ["draft", "registration_open", "fixtures_published"] as const) {
      const editable = getEditableTournamentFields({
        status,
        registrationCount: 36,
        leagueMatchesCompleted: 0,
      });

      expect(editable.has("tiebreakerProfile"), status).toBe(true);
    }

    const locked = getEditableTournamentFields({
      status: "league_phase",
      registrationCount: 36,
      leagueMatchesCompleted: 1,
    });

    expect(locked.has("tiebreakerProfile")).toBe(false);
  });
});

describe("filterTournamentPatch", () => {
  it("passes a fully editable patch and reports exactly the locked fields", () => {
    const draftResult = filterTournamentPatch(
      { status: "draft", registrationCount: 0 },
      {
        description: "New",
        rules: "New",
        startsAt: later,
      },
    );
    expect(draftResult.ok).toBe(true);
    expect(draftResult.locked).toEqual([]);

    const published = filterTournamentPatch(
      { status: "registration_open", registrationCount: 2 },
      {
        description: "New",
        name: "Renamed",
        season: "2027",
        timezone: "Europe/London",
      },
    );
    expect(published.ok).toBe(false);
    expect(published.locked).toEqual(["name", "season", "timezone"]);
  });

  it("reports the tie-break profile as locked after the first league result", () => {
    const result = filterTournamentPatch(
      { status: "league_phase", registrationCount: 36, leagueMatchesCompleted: 2 },
      { tiebreakerProfile: "classic", description: "Still editable" },
    );

    expect(result.ok).toBe(false);
    expect(result.locked).toEqual(["tiebreakerProfile"]);
  });
});

describe("checkRegistrationClosesAtChange", () => {
  it("rejects moving the deadline earlier", () => {
    expect(checkRegistrationClosesAtChange(later, earlier, now)).toContain("extended");
  });

  it("rejects an unchanged deadline", () => {
    expect(checkRegistrationClosesAtChange(later, later, now)).toContain("extended");
  });

  it("rejects extending into the past", () => {
    expect(checkRegistrationClosesAtChange(earlier, now, now)).toContain("future");
  });

  it("allows extending into the future", () => {
    expect(checkRegistrationClosesAtChange(earlier, later, now)).toBeNull();
  });
});

describe("checkStartsAtChange", () => {
  it("rejects a start before the registration deadline", () => {
    expect(checkStartsAtChange(earlier, later)).toContain("before registration closes");
  });

  it("allows a start exactly at the deadline and later", () => {
    expect(checkStartsAtChange(later, later)).toBeNull();
    expect(checkStartsAtChange(new Date(later.getTime() + 1), later)).toBeNull();
  });
});
