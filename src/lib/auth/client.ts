"use client";

// GCC — browser authentication helpers.
//
// Firebase owns credentials and emails. Our server owns the http-only session
// cookie. After any sign-in or verification change the client exchanges a fresh
// ID token at /api/auth/session; roles are never read from client data.
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";

import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { siteConfig } from "@/lib/config/site";
import type { UserRole } from "@/types/domain";

export interface SessionExchange {
  readonly role: UserRole;
  readonly emailVerified: boolean;
  readonly refreshRequired: boolean;
  readonly message?: string;
}

export class AuthClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthClientError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Request failed.";
  } catch {
    return "Request failed.";
  }
}

/** Exchanges an ID token for an http-only session cookie. */
export async function exchangeSession(idToken: string): Promise<SessionExchange> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new AuthClientError(await readError(response));
  }

  return (await response.json()) as SessionExchange;
}

/**
 * Signs in, exchanges the token and retries once with a force-refreshed token
 * when the server reports that custom claims changed.
 */
export async function signInWithSession(
  email: string,
  password: string,
): Promise<{ user: User; session: SessionExchange }> {
  const credential = await signInWithEmailAndPassword(getFirebaseClientAuth(), email, password);
  let session = await exchangeSession(await credential.user.getIdToken());

  if (session.refreshRequired) {
    session = await exchangeSession(await credential.user.getIdToken(true));
  }

  return { user: credential.user, session };
}

/** Reloads the user and re-exchanges a force-refreshed token. */
export async function refreshVerificationSession(): Promise<{
  user: User;
  session: SessionExchange;
}> {
  const auth = getFirebaseClientAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new AuthClientError("Sign in again to continue.");
  }

  await user.reload();
  const session = await exchangeSession(await user.getIdToken(true));
  return { user, session };
}

function verificationSettings(): ActionCodeSettings {
  return {
    url: `${siteConfig.url.replace(/\/+$/, "")}/verify-email`,
    handleCodeInApp: false,
  };
}

/** Sends Firebase's built-in verification email. */
export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user, verificationSettings());
}

/**
 * Requests a reset email. The caller always shows the same message so the
 * endpoint cannot be used to discover which addresses have accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseClientAuth(), email, {
      url: `${siteConfig.url.replace(/\/+$/, "")}/login`,
      handleCodeInApp: false,
    });
  } catch {
    // Deliberately ignored: the UI must not reveal whether the email exists.
  }
}

/** Clears the server cookie and the Firebase client session. */
export async function signOutCompletely(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } finally {
    try {
      await signOut(getFirebaseClientAuth());
    } catch {
      // The local session may already be gone.
    }
  }
}

/** Maps Firebase error codes to copy safe for an unauthenticated audience. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/user-disabled":
      return "This account is disabled. Contact the GCC team if you think this is a mistake.";
    case "auth/network-request-failed":
      return "The connection failed. Check your network and try again.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Use a stronger password.";
    default:
      return "We could not complete that request. Try again.";
  }
}
