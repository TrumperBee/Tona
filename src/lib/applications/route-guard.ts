// GCC - shared guard for applicant mutation routes.
//
// Order is fixed: same-origin, verified session, participant role, rate limit,
// platform write gate. Organiser and Super Admin accounts cannot use the
// applicant flow; their role is granted or managed elsewhere.
import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorizationError, requireVerifiedUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export type ApplicantGuardResult =
  | { readonly ok: true; readonly user: SessionUser }
  | { readonly ok: false; readonly response: NextResponse };

export async function guardApplicantMutation(
  request: NextRequest,
  scope: string,
  limit = 10,
  windowSeconds = 60,
): Promise<ApplicantGuardResult> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return { ok: false, response: jsonError("Cross-origin request rejected.", 403) };
    }

    throw error;
  }

  let user: SessionUser;

  try {
    user = await requireVerifiedUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, response: jsonError("Sign in to continue.", 401) };
    }

    if (error instanceof AuthorizationError) {
      return { ok: false, response: jsonError(error.message, 403) };
    }

    throw error;
  }

  if (user.role !== "user") {
    return {
      ok: false,
      response: jsonError("Organiser applications are for participant accounts only.", 403),
    };
  }

  const rate = await checkRateLimit(
    rateLimitPolicy(`applications:${scope}`, user.userId, limit, windowSeconds),
  );

  if (!rate.allowed) {
    return {
      ok: false,
      response: jsonError("Too many application actions. Try again shortly.", 429, {
        "Retry-After": String(rate.retryAfterSeconds),
      }),
    };
  }

  try {
    await assertPlatformWritable(user);
  } catch (error) {
    if (error instanceof PlatformWriteBlockedError) {
      return { ok: false, response: jsonError(error.message, 503) };
    }

    throw error;
  }

  return { ok: true, user };
}
