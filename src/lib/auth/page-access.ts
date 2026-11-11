// GCC - server-side page access.
//
// Route-group layouts call these helpers. They use the Phase 2 session guard
// (which verifies the cookie with revocation checks) and redirect on the server
// before any protected chrome is rendered.
import "server-only";

import { redirect } from "next/navigation";

import { AuthenticationError, hasSessionCookie, requireUser } from "@/lib/auth/guards";
import { hasRoleAtLeast } from "@/lib/auth/roles";
import { safeRedirectPath } from "@/lib/security/redirect";
import type { SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/types/domain";

function loginPath(nextPath: string): string {
  const safeNext = safeRedirectPath(nextPath) ?? "/";
  return `/login?next=${encodeURIComponent(safeNext)}`;
}

/**
 * Sends an unauthenticated visitor to sign-in. A cookie that is present but no
 * longer verifies means the session was revoked (for example after a role
 * change); the fixed `reason=permissions` flag lets the login page show a
 * friendly, non-injectable explanation.
 */
async function redirectToSignIn(nextPath: string): Promise<never> {
  const safeNext = safeRedirectPath(nextPath) ?? "/";

  if (await hasSessionCookie()) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&reason=permissions`);
  }

  redirect(loginPath(nextPath));
}

/**
 * Requires a valid, unrevoked session without requiring email verification.
 * The participant dashboard uses this so a player can read their own profile.
 */
export async function requirePageSignedIn(nextPath: string): Promise<SessionUser> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      // `redirect()` throws, and the throw must propagate through this
      // promise; calling it without `return` would drop the redirect and
      // re-throw the original authentication error instead.
      return redirectToSignIn(nextPath);
    }

    throw error;
  }
}

/**
 * Requires a valid, unrevoked session with an active account.
 * Unauthenticated visitors go to sign-in; suspended or banned accounts are
 * rejected by the session guard. Neither sees the protected shell.
 */
export async function requirePageUser(nextPath: string): Promise<SessionUser> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return redirectToSignIn(nextPath);
    }

    throw error;
  }
}

/** Requires at least the given role; wrong-role users are sent to their own workspace. */
export async function requirePageRole(role: UserRole, nextPath: string): Promise<SessionUser> {
  const user = await requirePageUser(nextPath);

  if (!hasRoleAtLeast(user.role, role)) {
    redirect(user.role === "organiser" ? "/organiser" : "/dashboard");
  }

  return user;
}

/** Requires the configured Super Admin account. */
export async function requirePageSuperAdmin(nextPath: string): Promise<SessionUser> {
  const user = await requirePageUser(nextPath);

  if (!user.isSuperAdmin) {
    redirect(user.role === "organiser" ? "/organiser" : "/dashboard");
  }

  return user;
}
