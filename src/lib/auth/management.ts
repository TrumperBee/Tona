// GCC — privileged user-role and account-status management.
//
// These functions must only be called after requireSuperAdmin(). The actor is
// still checked here as defence in depth, and every change writes an audit
// entry and revokes the target's refresh tokens so claims/sessions refresh.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { AuthorizationError, type AuthContext } from "@/lib/auth/guards";
import { assertRoleAssignmentAllowed, isSuperAdminEmail } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isAccountStatus, isUserRole, type AccountStatus, type UserRole } from "@/types/domain";

export interface RoleAssignmentResult {
  readonly uid: string;
  readonly role: UserRole;
}

/**
 * Sets the `role` custom claim for a user. Only the configured, verified
 * Super Admin email may receive `super_admin`, and that account cannot be
 * demoted. The target's refresh tokens are revoked so the new claim takes
 * effect on the next token refresh.
 */
export async function setUserRole(
  actor: AuthContext,
  targetUid: string,
  role: UserRole,
  reason?: string,
): Promise<RoleAssignmentResult> {
  if (actor.role !== "super_admin") {
    throw new AuthorizationError("Only the Super Admin may change roles.");
  }

  if (!isUserRole(role)) {
    throw new Error(`Unknown role: ${String(role)}`);
  }

  const env = getServerEnv();
  const auth = getFirebaseAdminAuth();
  const target = await auth.getUser(targetUid);

  assertRoleAssignmentAllowed(target.email, target.emailVerified, role, env.SUPER_ADMIN_EMAIL);

  const currentClaims = target.customClaims ?? {};
  const previousRole = isUserRole(currentClaims.role) ? currentClaims.role : null;

  // Remove the legacy boolean claim so there is exactly one role authority.
  const nextClaims: Record<string, unknown> = { ...currentClaims, role };
  delete nextClaims.superAdmin;

  await auth.setCustomUserClaims(targetUid, nextClaims);
  await auth.revokeRefreshTokens(targetUid);

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "user.role.set",
    targetType: "user",
    targetId: targetUid,
    before: { role: previousRole },
    after: { role },
    reason: reason ?? null,
  });

  return { uid: targetUid, role };
}

export interface AccountStatusResult {
  readonly uid: string;
  readonly status: AccountStatus;
}

/**
 * Enforces account status by disabling/enabling the Firebase Auth user,
 * revoking all refresh tokens and mirroring the status on the private user
 * document. The configured Super Admin account can never be suspended or
 * banned, and an actor cannot change their own status.
 */
export async function setAccountStatus(
  actor: AuthContext,
  targetUid: string,
  status: AccountStatus,
  reason?: string,
): Promise<AccountStatusResult> {
  if (actor.role !== "super_admin") {
    throw new AuthorizationError("Only the Super Admin may change account status.");
  }

  if (!isAccountStatus(status)) {
    throw new Error(`Unknown account status: ${String(status)}`);
  }

  if (actor.userId === targetUid) {
    throw new AuthorizationError("You cannot change your own account status.");
  }

  const env = getServerEnv();
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const target = await auth.getUser(targetUid);

  if (isSuperAdminEmail(target.email, env.SUPER_ADMIN_EMAIL) && status !== "active") {
    throw new AuthorizationError(
      "The configured Super Admin account cannot be suspended or banned.",
    );
  }

  const userReference = firestore.doc(paths.user(targetUid));
  const beforeSnapshot = await userReference.get();
  const beforeStatus = beforeSnapshot.exists ? (beforeSnapshot.data()?.status ?? null) : null;

  await auth.updateUser(targetUid, { disabled: status !== "active" });
  await auth.revokeRefreshTokens(targetUid);

  await userReference.set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "user.status.set",
    targetType: "user",
    targetId: targetUid,
    before: { status: beforeStatus, disabled: target.disabled },
    after: { status, disabled: status !== "active" },
    reason: reason ?? null,
  });

  return { uid: targetUid, status };
}
