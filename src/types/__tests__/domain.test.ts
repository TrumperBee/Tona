import { describe, expect, it } from "vitest";

import { canTransition, TOURNAMENT_STATUSES, type TournamentStatus } from "@/types/domain";

describe("canTransition", () => {
  it("allows the forward competitive lifecycle", () => {
    const forward: readonly [TournamentStatus, TournamentStatus][] = [
      ["draft", "registration_open"],
      ["registration_open", "registration_closed"],
      ["registration_closed", "pots_confirmed"],
      ["pots_confirmed", "fixtures_published"],
      ["fixtures_published", "league_phase"],
      ["league_phase", "knockout"],
      ["knockout", "completed"],
      ["completed", "archived"],
    ];

    for (const [from, to] of forward) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("allows suspension from every active pre-completion stage", () => {
    for (const from of TOURNAMENT_STATUSES) {
      if (
        from === "completed" ||
        from === "archived" ||
        from === "cancelled" ||
        from === "suspended"
      ) {
        continue;
      }

      expect(canTransition(from, "suspended"), `${from} -> suspended`).toBe(true);
    }
  });

  it("allows cancellation from every non-terminal stage", () => {
    for (const from of TOURNAMENT_STATUSES) {
      if (from === "completed" || from === "archived" || from === "cancelled") {
        continue;
      }

      expect(canTransition(from, "cancelled"), `${from} -> cancelled`).toBe(true);
    }
  });

  it("treats cancelled as terminal", () => {
    for (const to of TOURNAMENT_STATUSES) {
      expect(canTransition("cancelled", to), `cancelled -> ${to}`).toBe(false);
    }
  });

  it("never moves a terminal tournament back into the lifecycle", () => {
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("archived", "cancelled")).toBe(false);
  });

  it("allows a suspended tournament to resume at a non-archived stage", () => {
    for (const to of TOURNAMENT_STATUSES) {
      if (to === "archived" || to === "suspended") {
        continue;
      }

      expect(canTransition("suspended", to), `suspended -> ${to}`).toBe(true);
    }
  });

  it("treats archived as terminal", () => {
    for (const to of TOURNAMENT_STATUSES) {
      expect(canTransition("archived", to), `archived -> ${to}`).toBe(false);
    }
  });

  it("rejects backwards and same-state transitions", () => {
    expect(canTransition("registration_open", "draft")).toBe(false);
    expect(canTransition("completed", "league_phase")).toBe(false);
    expect(canTransition("draft", "draft")).toBe(false);
  });
});
