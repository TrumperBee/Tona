// GCC - shared guard for organiser mutation routes.
//
// Order is fixed: same-origin, organiser session (or higher), rate limit,
// platform write gate, then Zod validation in the route. A route must never
// reach business logic before this returns a user. Tournament-scoped routes
// additionally verify ownership inside the tournament mutation modules.
import "server-only";

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { AuthenticationError, AuthorizationError, requireRole } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export type OrganiserGuardResult =
  | { readonly ok: true; readonly user: SessionUser }
  | { readonly ok: false; readonly response: NextResponse };

export async function guardOrganiserMutation(
  request: NextRequest,
  scope: string,
  limit = 30,
  windowSeconds = 60,
): Promise<OrganiserGuardResult> {
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
    user = await requireRole("organiser");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, response: jsonError("Sign in to continue.", 401) };
    }

    if (error instanceof AuthorizationError) {
      return { ok: false, response: jsonError("Organiser access is required.", 403) };
    }

    throw error;
  }

  const rate = await checkRateLimit(
    rateLimitPolicy(`organiser:${scope}`, user.userId, limit, windowSeconds),
  );

  if (!rate.allowed) {
    return {
      ok: false,
      response: jsonError("Too many requests. Try again shortly.", 429, {
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
