// GCC — user roles and role-assignment policy.
//
// This module is intentionally free of Firebase, Next.js and environment
// imports so it can be unit tested as pure logic and imported by shared types.
// Server code is responsible for loading SUPER_ADMIN_EMAIL and SUPER_ADMIN_UID
// and passing them in.
import { isUserRole, USER_ROLES, type UserRole } from "@/types/domain";

export const ROLES = {
  USER: "user",
  ORGANISER: "organiser",
  SUPER_ADMIN: "super_admin",
} as const satisfies Record<string, UserRole>;

/** Backwards-compatible alias used by shared types. */
export type Role = UserRole;

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  organiser: "Organiser",
  super_admin: "Super Admin",
};

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  organiser: 1,
  super_admin: 2,
};

export function isRole(value: string): value is UserRole {
  return isUserRole(value);
}

/** True when `actual` grants every permission of `required`. */
export function hasRoleAtLeast(actual: UserRole, required: UserRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Normalises an email for comparison. Never use the result as a stored secret. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Normalises a UID for exact comparison. */
export function normalizeUid(uid: string | null | undefined): string {
  return (uid ?? "").trim();
}

/** Raised when an attempted role assignment violates the role policy. */
export class RoleAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleAssignmentError";
  }
}

export const SUPER_ADMIN_UID_MISSING_MESSAGE =
  "SUPER_ADMIN_UID is not configured, so the Super Admin role is withheld from everyone. " +
  "Set SUPER_ADMIN_UID in .env.local to the uid of the SUPER_ADMIN_EMAIL account " +
  "(Firebase Console → Authentication → Users) and redeploy.";

let warnedAboutMissingSuperAdminUid = false;

/** Logs one clear server-side error when the UID pin is missing. */
export function warnMissingSuperAdminUid(): void {
  if (warnedAboutMissingSuperAdminUid) {
    return;
  }

  warnedAboutMissingSuperAdminUid = true;
  console.error(SUPER_ADMIN_UID_MISSING_MESSAGE);
}

/**
 * True only when the account matches BOTH configured Super Admin identifiers.
 * A missing or blank UID pin fails closed for every account (ADR-047).
 */
export function isSuperAdminAccount(
  email: string | null | undefined,
  uid: string | null | undefined,
  superAdminEmail: string | null | undefined,
  superAdminUid: string | null | undefined,
): boolean {
  const configuredEmail = normalizeEmail(superAdminEmail);
  const configuredUid = normalizeUid(superAdminUid);

  if (configuredEmail.length === 0 || configuredUid.length === 0) {
    return false;
  }

  return normalizeEmail(email) === configuredEmail && normalizeUid(uid) === configuredUid;
}

/**
 * Enforces the only role-assignment rules the platform permits.
 *
 * The function is pure: callers must supply the configured Super Admin email
 * and UID (normally `getServerEnv()`), not read the environment here.
 *
 * Rules:
 * - `super_admin` is allowed only when the target's email AND uid match the
 *   configured Super Admin identifiers. Email verification plays no part.
 * - The configured Super Admin account can never be demoted to another role.
 * - An unknown role is rejected at runtime.
 */
export function assertRoleAssignmentAllowed(
  targetEmail: string | null | undefined,
  targetUid: string | null | undefined,
  role: UserRole,
  superAdminEmail: string = "",
  superAdminUid: string = "",
): void {
  if (!isUserRole(role)) {
    throw new RoleAssignmentError(`Unknown role: ${String(role)}`);
  }

  const configuredEmail = normalizeEmail(superAdminEmail);
  const configuredUid = normalizeUid(superAdminUid);
  const targetIsConfiguredSuperAdmin = isSuperAdminAccount(
    targetEmail,
    targetUid,
    superAdminEmail,
    superAdminUid,
  );

  if (role === "super_admin") {
    if (configuredEmail.length === 0) {
      throw new RoleAssignmentError(
        "SUPER_ADMIN_EMAIL is not configured, so the Super Admin role cannot be assigned.",
      );
    }

    if (configuredUid.length === 0) {
      throw new RoleAssignmentError(SUPER_ADMIN_UID_MISSING_MESSAGE);
    }

    if (!targetIsConfiguredSuperAdmin) {
      throw new RoleAssignmentError(
        "The Super Admin role can only be granted to the configured SUPER_ADMIN_EMAIL and SUPER_ADMIN_UID account.",
      );
    }

    return;
  }

  if (targetIsConfiguredSuperAdmin) {
    throw new RoleAssignmentError(
      "The configured Super Admin account cannot be demoted to another role.",
    );
  }
}

export { isUserRole, USER_ROLES };
export type { UserRole };
