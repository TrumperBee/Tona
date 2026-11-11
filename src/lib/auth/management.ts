// GCC — privileged user-role and account-status management.
//
// These functions must only be called after requireSuperAdmin(). The actor is
// still checked here as defence in depth, and every change writes an audit
// entry and revokes the target's refresh tokens so claims/sessions refresh.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { AuthorizationError, type AuthContext } from "@/lib/auth/guards";
import {
  assertRoleAssignmentAllowed,
  isSuperAdminAccount,
  warnMissingSuperAdminUid,
} from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import {
  isAccountStatus,
  isUserRole,
  type AccountStatus,
  type AdminApplicationDocument,
  type UserRole,
} from "@/types/domain";

export interface RoleAssignmentResult {
  readonly uid: string;
  readonly role: UserRole;
}

/**
 * Sets the `role` custom claim for a user. Only the configured Super Admin
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

  if (!env.SUPER_ADMIN_UID) {
    warnMissingSuperAdminUid();
  }

  assertRoleAssignmentAllowed(
    target.email,
    target.uid,
    role,
    env.SUPER_ADMIN_EMAIL,
    env.SUPER_ADMIN_UID ?? "",
  );

  const currentClaims = target.customClaims ?? {};
  const previousRole = isUserRole(currentClaims.role) ? currentClaims.role : null;

  // Defence in depth: never let a manual role action touch a Super Admin,
  // including the caller. Only the configured account may hold that claim, and
  // it is never changed from the console.
  if (
    previousRole === "super_admin" ||
    isSuperAdminAccount(target.email, target.uid, env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_UID)
  ) {
    throw new AuthorizationError("A Super Admin account cannot be changed here.");
  }

  // Remove the legacy boolean claim so there is exactly one role authority.
  const nextClaims: Record<string, unknown> = { ...currentClaims, role };
  delete nextClaims.superAdmin;

  await auth.setCustomUserClaims(targetUid, nextClaims);
  await auth.revokeRefreshTokens(targetUid);

  // Keep the display-only users.role field in step with the claim.
  await getFirebaseAdminFirestore()
    .doc(paths.user(targetUid))
    .set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

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

  // Revoking an organiser is also a review outcome. Mark their latest approved
  // application so the application history reflects why the role ended.
  if (previousRole === "organiser" && role === "user") {
    const applications = await getFirebaseAdminFirestore()
      .collection(paths.adminApplications())
      .where("uid", "==", targetUid)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    const approved = applications.docs.find(
      (document) => (document.data() as AdminApplicationDocument).status === "approved",
    );

    if (approved) {
      await approved.ref.update({
        status: "revoked",
        updatedAt: FieldValue.serverTimestamp(),
      });

      await writeAuditLog({
        actorUid: actor.userId,
        actorRole: actor.role,
        action: "application.revoked",
        targetType: "adminApplication",
        targetId: approved.id,
        before: { status: "approved" },
        after: { status: "revoked" },
        reason: reason ?? null,
      });

      try {
        await createNotification(targetUid, {
          type: "application",
          title: "Organiser permissions revoked",
          body: reason?.trim()
            ? `Your organiser role was revoked: ${reason.trim()}`
            : "Your organiser role was revoked by the Super Admin.",
          link: "/dashboard/apply-admin",
        });
      } catch {
        // The role change is already complete; notification failure must not
        // make the console retry a destructive action.
      }
    }
  }

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
  const targetClaims = target.customClaims ?? {};
  const targetRole = isUserRole(targetClaims.role) ? targetClaims.role : null;

  if (
    targetRole === "super_admin" ||
    isSuperAdminAccount(target.email, target.uid, env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_UID)
  ) {
    throw new AuthorizationError(
      "The configured Super Admin account cannot be suspended or banned.",
    );
  }

  const userReference = firestore.doc(paths.user(targetUid));
  const publicReference = firestore.doc(paths.publicProfile(targetUid));
  const [beforeSnapshot, publicSnapshot] = await Promise.all([
    userReference.get(),
    publicReference.get(),
  ]);
  const beforeStatus = beforeSnapshot.exists ? (beforeSnapshot.data()?.status ?? null) : null;

  const batch = firestore.batch();
  batch.set(
    userReference,
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // The public document mirrors only the status so the public profile can show
  // "Profile unavailable" without exposing anything private.
  if (publicSnapshot.exists) {
    batch.set(publicReference, { status }, { merge: true });
  }

  await auth.updateUser(targetUid, { disabled: status !== "active" });
  await auth.revokeRefreshTokens(targetUid);
  await batch.commit();

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
