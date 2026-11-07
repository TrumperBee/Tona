// GCC — server-side authorisation guards.
//
// Every guard verifies the http-only Firebase session cookie with
// `checkRevoked: true` and reads the role from the verified token's custom
// claim. Client-supplied roles, headers and form fields are never consulted.
import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { hasRoleAtLeast, isSuperAdminEmail, isUserRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { TournamentDocument, UserRole } from "@/types/domain";

export type AuthContext = SessionUser;

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "You are not authorised to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;

  constructor(message = "The requested record was not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

function roleFromToken(decoded: DecodedIdToken): UserRole {
  return isUserRole(decoded.role) ? decoded.role : "user";
}

/**
 * Returns the current user, or null when there is no valid, unrevoked session.
 * Disabled Firebase Auth users are treated as signed out.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  let cookieValue: string | undefined;

  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }

  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(cookieValue, true);
    const userRecord = await getFirebaseAdminAuth().getUser(decoded.uid);

    if (userRecord.disabled) {
      return null;
    }

    const role = roleFromToken(decoded);
    const emailVerified = decoded.email_verified === true;

    return {
      userId: decoded.uid,
      email: userRecord.email ?? decoded.email ?? "",
      emailVerified,
      role,
      isSuperAdmin: role === "super_admin",
    };
  } catch {
    // Missing, expired, revoked or malformed cookies all mean "not signed in".
    return null;
  }
}

/** Requires a valid, unrevoked session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

/** Requires a valid session whose email Firebase has verified. */
export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await requireUser();

  if (!user.emailVerified) {
    throw new AuthorizationError("Verify your email address before continuing.");
  }

  return user;
}

/**
 * Requires the user's role to grant at least the requested role.
 * The hierarchy is user < organiser < super_admin.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireVerifiedUser();

  if (!hasRoleAtLeast(user.role, role)) {
    throw new AuthorizationError();
  }

  return user;
}

/**
 * Requires the configured Super Admin role claim. The email check is a second
 * line of defence in case the owner changes in configuration while an old
 * claim is still present in a token.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireVerifiedUser();
  const env = getServerEnv();

  if (user.role !== "super_admin" || !isSuperAdminEmail(user.email, env.SUPER_ADMIN_EMAIL)) {
    throw new AuthorizationError("Super Admin access is required.");
  }

  return user;
}

export interface TournamentAccess {
  readonly user: SessionUser;
  readonly tournament: TournamentDocument;
}

/**
 * Loads a tournament from Firestore and requires the caller to be its owner or
 * the Super Admin. Ownership is read from the server document, never from the
 * request.
 */
export async function requireTournamentOwnerOrSuperAdmin(
  tournamentId: string,
): Promise<TournamentAccess> {
  const user = await requireVerifiedUser();
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(tournamentId)).get();

  if (!snapshot.exists) {
    throw new NotFoundError("Tournament not found.");
  }

  const tournament = snapshot.data() as TournamentDocument;

  if (tournament.ownerUid !== user.userId && user.role !== "super_admin") {
    throw new AuthorizationError("Only the tournament owner or Super Admin may do this.");
  }

  return { user, tournament };
}
