// GCC — session role reconciliation.
//
// The Super Admin role is derived from the configured, VERIFIED email at session
// exchange time. Registration never sets a custom claim, so an account that
// squats the owner address before verification has no elevated authority.
//
// The pure resolver is exported for unit tests. The Admin-SDK wrapper is used by
// POST /api/auth/session and by emulator integration tests.
import "server-only";

import { isSuperAdminEmail, isUserRole } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import type { UserRole } from "@/types/domain";

export interface RoleResolution {
  readonly role: UserRole;
  readonly refreshRequired: boolean;
  /** A stale privileged claim must be stripped and refresh tokens revoked. */
  readonly revoke: boolean;
}

export interface RoleResolutionInput {
  readonly email: string | undefined;
  readonly emailVerified: boolean;
  readonly customClaims: Readonly<Record<string, unknown>> | undefined;
  readonly superAdminEmail: string;
}

export function resolveSessionRole(input: RoleResolutionInput): RoleResolution {
  const currentClaim = isUserRole(input.customClaims?.role) ? input.customClaims.role : "user";
  const hasLegacyClaim = input.customClaims?.superAdmin !== undefined;
  const mayBeSuperAdmin =
    input.emailVerified && isSuperAdminEmail(input.email, input.superAdminEmail);

  if (mayBeSuperAdmin) {
    return {
      role: "super_admin",
      refreshRequired: currentClaim !== "super_admin" || hasLegacyClaim,
      revoke: false,
    };
  }

  if (currentClaim === "super_admin") {
    // The owner email changed or is no longer verified. Strip the claim and
    // force a fresh sign-in rather than issuing a privileged cookie.
    return { role: "user", refreshRequired: true, revoke: true };
  }

  return {
    role: currentClaim,
    refreshRequired: hasLegacyClaim,
    revoke: false,
  };
}

export interface SyncedSessionRole {
  readonly role: UserRole;
  readonly emailVerified: boolean;
  readonly refreshRequired: boolean;
  readonly revoked: boolean;
}

/**
 * Applies the role resolution to Firebase Auth. Callers must already have
 * verified the user's ID token.
 */
export async function syncSessionRole(uid: string): Promise<SyncedSessionRole> {
  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(uid);
  const resolution = resolveSessionRole({
    email: user.email,
    emailVerified: user.emailVerified,
    customClaims: user.customClaims,
    superAdminEmail: getServerEnv().SUPER_ADMIN_EMAIL,
  });

  if (resolution.revoke || resolution.refreshRequired) {
    const claims: Record<string, unknown> = { ...(user.customClaims ?? {}), role: resolution.role };
    delete claims.superAdmin;
    await auth.setCustomUserClaims(uid, claims);
  }

  if (resolution.revoke) {
    await auth.revokeRefreshTokens(uid);
  }

  return {
    role: resolution.role,
    emailVerified: user.emailVerified,
    refreshRequired: resolution.refreshRequired,
    revoked: resolution.revoke,
  };
}
