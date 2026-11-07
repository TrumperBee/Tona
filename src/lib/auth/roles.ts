// GCC — user roles and role-assignment policy.
//
// This module is intentionally free of Firebase, Next.js and environment
// imports so it can be unit tested as pure logic and imported by shared types.
// Server code is responsible for loading SUPER_ADMIN_EMAIL and passing it in.
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

/** Raised when an attempted role assignment violates the role policy. */
export class RoleAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleAssignmentError";
  }
}

/**
 * Enforces the only role-assignment rules the platform permits.
 *
 * The function is pure: callers must supply the configured Super Admin email
 * (normally `getServerEnv().SUPER_ADMIN_EMAIL`) rather than reading the
 * environment here. The optional parameter keeps the three-argument call shape
 * for callers that have already validated their inputs; omitting it makes
 * `super_admin` assignments fail closed.
 *
 * Rules:
 * - `super_admin` is allowed only when the target email matches the configured
 *   Super Admin email case-insensitively and the target email is verified.
 * - The configured Super Admin account can never be demoted to another role.
 * - An unknown role is rejected at runtime.
 */
export function assertRoleAssignmentAllowed(
  targetEmail: string | null | undefined,
  targetEmailVerified: boolean,
  role: UserRole,
  superAdminEmail: string = "",
): void {
  if (!isUserRole(role)) {
    throw new RoleAssignmentError(`Unknown role: ${String(role)}`);
  }

  const configuredSuperAdmin = normalizeEmail(superAdminEmail);
  const target = normalizeEmail(targetEmail);
  const targetIsConfiguredSuperAdmin =
    configuredSuperAdmin.length > 0 && target === configuredSuperAdmin;

  if (role === "super_admin") {
    if (!targetEmailVerified) {
      throw new RoleAssignmentError("The Super Admin account must have a verified email address.");
    }

    if (configuredSuperAdmin.length === 0) {
      throw new RoleAssignmentError(
        "SUPER_ADMIN_EMAIL is not configured, so the Super Admin role cannot be assigned.",
      );
    }

    if (!targetIsConfiguredSuperAdmin) {
      throw new RoleAssignmentError(
        "The Super Admin role can only be granted to the configured SUPER_ADMIN_EMAIL account.",
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

export function isSuperAdminEmail(
  email: string | null | undefined,
  superAdminEmail: string | null | undefined,
): boolean {
  const configured = normalizeEmail(superAdminEmail);
  return configured.length > 0 && normalizeEmail(email) === configured;
}

export { isUserRole, USER_ROLES };
export type { UserRole };
