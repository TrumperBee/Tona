// GCC - change the signed-in account's email address.
//
// PATCH /api/profile/email
// Requires a session created in the last ten minutes, a same-origin request and
// a budget of three attempts per day. Every session is revoked afterwards, so
// the response also clears the cookie and asks the browser to sign in again.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireFreshSession } from "@/lib/auth/guards";
import { clearSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { changeAccountEmail, EmailChangeError } from "@/lib/profile/email";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { changeEmailSchema } from "@/lib/validation/email";

export const runtime = "nodejs";

const EMAIL_CHANGE_LIMIT = { limit: 3, windowSeconds: 24 * 60 * 60 } as const;

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  let user;

  try {
    user = await requireFreshSession();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError(error.message, 401);
    }

    throw error;
  }

  try {
    await assertPlatformWritable(user);
  } catch (error) {
    if (error instanceof PlatformWriteBlockedError) {
      return jsonError(error.message, 503);
    }

    throw error;
  }

  const rate = await checkRateLimit(
    rateLimitPolicy(
      "profile:email",
      user.userId,
      EMAIL_CHANGE_LIMIT.limit,
      EMAIL_CHANGE_LIMIT.windowSeconds,
    ),
  );

  if (!rate.allowed) {
    return jsonError(
      `You can change your email up to ${EMAIL_CHANGE_LIMIT.limit} times a day.`,
      429,
      {
        "Retry-After": String(rate.retryAfterSeconds),
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = changeEmailSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Enter a valid email address.";
    return NextResponse.json({ error: message, fieldErrors: { email: message } }, { status: 400 });
  }

  try {
    const result = await changeAccountEmail(user, parsed.data.email);
    const response = NextResponse.json({
      ok: true,
      email: result.email,
      signedOut: true,
    });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof EmailChangeError) {
      if (error.code === "pinned-super-admin") {
        return jsonError(error.message, 403);
      }

      if (error.code === "in-use" || error.code === "unchanged") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { email: error.message } },
          { status: error.status },
        );
      }

      return jsonError(error.message, error.status);
    }

    return jsonError("We could not change your email address. Try again.", 500);
  }
}
