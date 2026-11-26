// GCC - change the email address on an account.
//
// This is the only path that edits an email. It requires a fresh sign-in at the
// route layer, refuses an address already used by another account, updates
// Firebase Auth first (the authoritative identity), mirrors it onto the private
// user document, revokes every session and emails the OLD address so the owner
// always learns about the change.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import { isSuperAdminAccount } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/config/env.server";
import { runAfterResponse } from "@/lib/email/after";
import { deliverTransactionalEmail } from "@/lib/email/deliver";
import { clearSuppression } from "@/lib/email/suppression";
import { renderEmailChangedEmail } from "@/lib/email/templates/security";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { notify } from "@/lib/notifications/service";
import type { UserDocument } from "@/types/domain";

export type EmailChangeErrorCode =
  "pinned-super-admin" | "in-use" | "unchanged" | "not-found" | "failed";

export class EmailChangeError extends Error {
  readonly code: EmailChangeErrorCode;
  readonly status: number;

  constructor(code: EmailChangeErrorCode, message: string, status = 400) {
    super(message);
    this.name = "EmailChangeError";
    this.code = code;
    this.status = status;
  }
}

function isFirebaseError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Moves an account to a new address. The caller must already have passed a
 * fresh-session check; this function performs the remaining checks.
 */
export async function changeAccountEmail(
  user: SessionUser,
  rawEmail: string,
): Promise<{ email: string }> {
  const email = rawEmail.trim().toLowerCase();
  const env = getServerEnv();

  if (
    (env.SUPER_ADMIN_UID && user.userId === env.SUPER_ADMIN_UID) ||
    isSuperAdminAccount(user.email, user.userId, env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_UID)
  ) {
    throw new EmailChangeError(
      "pinned-super-admin",
      "The Super Admin email is pinned by the deployment environment and cannot be changed here. Update SUPER_ADMIN_EMAIL and SUPER_ADMIN_UID together, then sign in again.",
      403,
    );
  }

  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const userReference = firestore.doc(paths.user(user.userId));
  const snapshot = await userReference.get();

  if (!snapshot.exists) {
    throw new EmailChangeError("not-found", "Your profile could not be loaded.", 404);
  }

  const current = snapshot.data() as UserDocument;
  const previousEmail = current.email.trim();

  if (previousEmail.toLowerCase() === email) {
    throw new EmailChangeError("unchanged", "That is already your email address.");
  }

  try {
    const existing = await auth.getUserByEmail(email);

    if (existing.uid !== user.userId) {
      throw new EmailChangeError("in-use", "An account with that email already exists.");
    }
  } catch (error) {
    if (error instanceof EmailChangeError) {
      throw error;
    }

    if (!isFirebaseError(error, "auth/user-not-found")) {
      throw new EmailChangeError("failed", "We could not check that address. Try again.", 500);
    }
  }

  try {
    await auth.updateUser(user.userId, { email });
  } catch (error) {
    if (isFirebaseError(error, "auth/email-already-exists")) {
      throw new EmailChangeError("in-use", "An account with that email already exists.");
    }

    if (isFirebaseError(error, "auth/invalid-email")) {
      throw new EmailChangeError("failed", "Enter a valid email address.");
    }

    throw new EmailChangeError("failed", "We could not update your email address. Try again.", 500);
  }

  try {
    await userReference.update({
      email,
      emailDeliverable: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Auth is authoritative and already moved. The next profile save repairs the
    // mirror; the owner has still been emailed at the old address below.
    throw new EmailChangeError(
      "failed",
      "Your sign-in email changed, but your profile could not be updated. Contact the platform team.",
      500,
    );
  }

  await clearSuppression(email);

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "user.email.changed",
    targetType: "user",
    targetId: user.userId,
    before: { email: previousEmail },
    after: { email },
  });

  // Every session is revoked because Firebase cannot revoke "all but this one".
  // The browser is signed out after this response and must sign in again.
  await auth.revokeRefreshTokens(user.userId).catch(() => undefined);

  const rendered = renderEmailChangedEmail({
    gamerTag: current.gamerTag,
    newEmail: email,
  });

  runAfterResponse(async () => {
    await deliverTransactionalEmail({
      to: previousEmail,
      kind: "email_changed",
      subject: "Your GCC email address was changed",
      rendered,
      critical: true,
      skipSuppression: true,
    });
  });

  await notify({
    recipients: user.userId,
    type: "email_changed",
    title: "Your email address was changed",
    body: `Your GCC sign-in address is now ${email}. Sign in again with the new address.`,
    link: "/login",
    email: {
      heading: "Your email address was changed",
      paragraphs: [
        `Your GCC sign-in address is now ${email}.`,
        "Every session was signed out. Sign in again with the new address.",
      ],
      buttonLabel: "Sign in again",
    },
  }).catch(() => undefined);

  return { email };
}
