// GCC - server-side page access.
//
// Route-group layouts call these helpers. They use the Phase 2 session guard
// (which verifies the cookie with revocation checks) and redirect on the server
// before any protected chrome is rendered.
import "server-only";

import { redirect } from "next/navigation";

import { AuthenticationError, requireVerifiedUser } from "@/lib/auth/guards";
import { hasRoleAtLeast } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/types/domain";

function loginPath(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

/**
 * Requires a valid, unrevoked session with a verified email.
 * Unauthenticated visitors go to sign-in; unverified accounts go to the
 * verification page. Neither sees the protected shell.
 */
export async function requirePageUser(nextPath: string): Promise<SessionUser> {
  try {
    return await requireVerifiedUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(loginPath(nextPath));
    }

    redirect("/verify-email");
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
