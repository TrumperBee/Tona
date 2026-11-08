// GCC — session exchange routes.
//
// POST   /api/auth/session  verifies a Firebase ID token and sets an http-only
//                           session cookie after account-status checks.
// DELETE /api/auth/session  clears the cookie and revokes refresh tokens.
//
// Clients never send a role. The role returned here comes from server-side
// custom claims (or the SUPER_ADMIN_EMAIL rule) so the client can force a token
// refresh when claims changed.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, SESSION_RATE_LIMIT } from "@/lib/auth/constants";
import { isSuperAdminEmail, isUserRole } from "@/lib/auth/roles";
import { clearSessionCookie, createSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { sessionExchangeSchema } from "@/lib/validation/auth";
import { isAccountStatus, type UserRole } from "@/types/domain";

export const runtime = "nodejs";

function clientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  return first || request.headers.get("x-real-ip") || "unknown";
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = sessionExchangeSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("A valid Firebase ID token is required.", 400);
  }

  const limit = await checkRateLimit(
    rateLimitPolicy(
      "auth:session",
      clientIdentifier(request),
      SESSION_RATE_LIMIT.limit,
      SESSION_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(parsed.data.idToken, true);
    const user = await auth.getUser(decoded.uid);

    if (user.disabled) {
      return jsonError("This account is disabled.", 403);
    }

    const privateSnapshot = await getFirebaseAdminFirestore().doc(paths.user(user.uid)).get();
    const privateStatus = privateSnapshot.exists ? privateSnapshot.data()?.status : "active";

    if (isAccountStatus(privateStatus) && privateStatus !== "active") {
      return jsonError(`This account is ${privateStatus}.`, 403);
    }

    const env = getServerEnv();
    const configuredSuperAdmin = isSuperAdminEmail(user.email, env.SUPER_ADMIN_EMAIL);
    const allowedSuperAdmin = configuredSuperAdmin && user.emailVerified;
    const currentClaimValue = user.customClaims?.role;
    const currentClaim = isUserRole(currentClaimValue) ? currentClaimValue : "user";

    let role: UserRole = currentClaim;

    if (allowedSuperAdmin) {
      role = "super_admin";
    } else if (currentClaim === "super_admin") {
      // The configuration changed, or the owner's email is no longer verified.
      // Strip the stale privileged claim and force a fresh sign-in rather than
      // issuing a cookie that could still read Super Admin-only data.
      const claims: Record<string, unknown> = { ...(user.customClaims ?? {}), role: "user" };
      delete claims.superAdmin;
      await auth.setCustomUserClaims(user.uid, claims);
      await auth.revokeRefreshTokens(user.uid);

      return NextResponse.json({
        role: "user" satisfies UserRole,
        refreshRequired: true,
        message: "Your account permissions changed. Refresh your token and sign in again.",
      });
    }

    const claimsChanged = currentClaim !== role || user.customClaims?.superAdmin !== undefined;

    if (claimsChanged) {
      const claims: Record<string, unknown> = { ...(user.customClaims ?? {}), role };
      delete claims.superAdmin;
      await auth.setCustomUserClaims(user.uid, claims);
    }

    const sessionCookie = await createSessionCookie(parsed.data.idToken);
    const response = NextResponse.json({
      role,
      emailVerified: user.emailVerified,
      refreshRequired: claimsChanged,
    });
    setSessionCookie(response, sessionCookie);

    return response;
  } catch {
    // Do not reveal whether an account exists, whether it is disabled, or why
    // token verification failed.
    return jsonError("Could not create a session. Sign in again.", 401);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (cookieValue) {
    try {
      const auth = getFirebaseAdminAuth();
      const decoded = await auth.verifySessionCookie(cookieValue, false);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      // An expired or malformed cookie is still cleared below.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
