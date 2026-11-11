// GCC — session role reconciliation.
//
// The Super Admin role is derived at session exchange time from the configured
// email AND uid, never from email verification. Registration never sets a custom
// claim, so an account that squats the owner address with a different uid has no
// elevated authority.
//
// The pure resolver is exported for unit tests. The Admin-SDK wrapper is used by
// POST /api/auth/session and by emulator integration tests.
import "server-only";

import { isSuperAdminAccount, isUserRole, warnMissingSuperAdminUid } from "@/lib/auth/roles";
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
  readonly uid: string;
  readonly email: string | undefined;
  readonly customClaims: Readonly<Record<string, unknown>> | undefined;
  readonly superAdminEmail: string;
  readonly superAdminUid: string;
}

export function resolveSessionRole(input: RoleResolutionInput): RoleResolution {
  const currentClaim = isUserRole(input.customClaims?.role) ? input.customClaims.role : "user";
  const hasLegacyClaim = input.customClaims?.superAdmin !== undefined;
  const mayBeSuperAdmin = isSuperAdminAccount(
    input.email,
    input.uid,
    input.superAdminEmail,
    input.superAdminUid,
  );

  if (mayBeSuperAdmin) {
    return {
      role: "super_admin",
      refreshRequired: currentClaim !== "super_admin" || hasLegacyClaim,
      revoke: false,
    };
  }

  if (currentClaim === "super_admin") {
    // The configured email or uid changed (or the UID pin is missing). Strip the
    // claim and force a fresh sign-in rather than issuing a privileged cookie.
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
  const env = getServerEnv();

  if (!env.SUPER_ADMIN_UID) {
    warnMissingSuperAdminUid();
  }

  const resolution = resolveSessionRole({
    uid,
    email: user.email,
    customClaims: user.customClaims,
    superAdminEmail: env.SUPER_ADMIN_EMAIL,
    superAdminUid: env.SUPER_ADMIN_UID ?? "",
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
    refreshRequired: resolution.refreshRequired,
    revoked: resolution.revoke,
  };
}
