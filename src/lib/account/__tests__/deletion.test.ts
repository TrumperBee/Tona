import { describe, expect, it } from "vitest";

import {
  DELETED_PLAYER_LABEL,
  isActiveTournamentStatus,
  resolveDeletionEligibility,
  type DeletionEligibilityInput,
} from "@/lib/account/deletion";
import type { TournamentStatus } from "@/types/domain";

function input(overrides: Partial<DeletionEligibilityInput> = {}): DeletionEligibilityInput {
  return {
    role: "user",
    authRole: null,
    legacySuperAdminClaim: false,
    pinnedSuperAdmin: false,
    activeTournaments: [],
    ...overrides,
  };
}

describe("account deletion policy", () => {
  it("uses the fixed Deleted player placeholder", () => {
    expect(DELETED_PLAYER_LABEL).toBe("Deleted player");
  });

  it("treats draft, registration, in-play and suspended tournaments as active", () => {
    const active: TournamentStatus[] = [
      "draft",
      "registration_open",
      "registration_closed",
      "pots_confirmed",
      "fixtures_published",
      "league_phase",
      "knockout",
      "suspended",
    ];

    for (const status of active) {
      expect(isActiveTournamentStatus(status)).toBe(true);
    }

    for (const status of ["completed", "archived", "cancelled"] as const) {
      expect(isActiveTournamentStatus(status)).toBe(false);
    }
  });

  it("allows an ordinary player with no active tournaments", () => {
    expect(resolveDeletionEligibility(input())).toMatchObject({ allowed: true, block: null });
  });

  it("allows a player whose entries are still registered", () => {
    // Registration state is deliberately absent from the decision: entries are
    // anonymised in place and never released.
    expect(resolveDeletionEligibility(input({ role: "user" })).allowed).toBe(true);
  });

  it("blocks a super admin from any claim source", () => {
    for (const overrides of [
      { role: "super_admin" as const },
      { authRole: "super_admin" as const },
      { legacySuperAdminClaim: true },
      { pinnedSuperAdmin: true },
    ]) {
      expect(resolveDeletionEligibility(input(overrides))).toMatchObject({
        allowed: false,
        block: "super_admin",
      });
    }
  });

  it("blocks an organiser only while they own a live tournament", () => {
    const organiser = input({ role: "organiser", authRole: "organiser" });

    expect(
      resolveDeletionEligibility({
        ...organiser,
        activeTournaments: [{ id: "t1", name: "Live Cup", status: "fixtures_published" }],
      }),
    ).toMatchObject({ allowed: false, block: "active_tournaments" });

    expect(
      resolveDeletionEligibility({
        ...organiser,
        activeTournaments: [{ id: "t2", name: "Old Cup", status: "completed" }],
      }),
    ).toMatchObject({ allowed: true, block: null });
  });
});
