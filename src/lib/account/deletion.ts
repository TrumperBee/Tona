// GCC — account-deletion policy (pure logic).
//
// Self-service deletion is intentionally conservative. Nothing that other
// people depend on is released silently: gamer tags stay reserved, tournament
// entries stay in place, and completed results keep the original gamer tag.
// Only identity/contact fields on the player's own documents are minimised.
import type { UserRole } from "@/lib/auth/roles";
import type { TournamentStatus } from "@/types/domain";

export const DELETED_PLAYER_LABEL = "Deleted player";
export const DELETED_PLAYER_TAG_LOWER = "deleted player";

/** Terminal competitions are history; everything else is still an active duty. */
export const TERMINAL_TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  "completed",
  "archived",
  "cancelled",
];

export function isActiveTournamentStatus(status: TournamentStatus): boolean {
  return !TERMINAL_TOURNAMENT_STATUSES.includes(status);
}

export interface ActiveTournamentRef {
  readonly id: string;
  readonly name: string;
  readonly status: TournamentStatus;
}

export type AccountDeletionBlock = "super_admin" | "active_tournaments";

export interface DeletionEligibilityInput {
  /** Role in the verified session claim. */
  readonly role: UserRole;
  /** Role in Firebase Auth custom claims, re-checked at deletion time. */
  readonly authRole: UserRole | null;
  /** Legacy boolean `superAdmin` claim, if present. */
  readonly legacySuperAdminClaim: boolean;
  /** Email AND uid match the configured pin. */
  readonly pinnedSuperAdmin: boolean;
  readonly activeTournaments: readonly ActiveTournamentRef[];
}

export interface DeletionEligibility {
  readonly allowed: boolean;
  readonly block: AccountDeletionBlock | null;
  readonly activeTournaments: readonly ActiveTournamentRef[];
}

/**
 * Super Admins and organisers who still own a live competition cannot delete
 * their account here. Other accounts may, regardless of registration state:
 * their existing entries are anonymised in place, never withdrawn or released.
 */
export function resolveDeletionEligibility(input: DeletionEligibilityInput): DeletionEligibility {
  // Re-filter here rather than trusting the caller: a terminal tournament must
  // never block an otherwise eligible former organiser.
  const activeTournaments = input.activeTournaments.filter((tournament) =>
    isActiveTournamentStatus(tournament.status),
  );
  const isSuperAdmin =
    input.role === "super_admin" ||
    input.authRole === "super_admin" ||
    input.legacySuperAdminClaim ||
    input.pinnedSuperAdmin;

  if (isSuperAdmin) {
    return { allowed: false, block: "super_admin", activeTournaments };
  }

  if (activeTournaments.length > 0) {
    return {
      allowed: false,
      block: "active_tournaments",
      activeTournaments,
    };
  }

  return { allowed: true, block: null, activeTournaments: [] };
}

export const ACCOUNT_DELETION_BLOCK_MESSAGES: Readonly<Record<AccountDeletionBlock, string>> = {
  super_admin: "The configured Super Admin account cannot be deleted.",
  active_tournaments:
    "Finish, cancel or transfer your active tournaments before deleting your account.",
};
