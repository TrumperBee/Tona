// GCC - update the signed-in user's email preferences.
//
// PATCH /api/notifications/preferences
// The owner is always the session UID. Critical account mail is not represented
// here and therefore cannot be disabled.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { writeNotificationPrefs } from "@/lib/notifications/preferences";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { notificationPreferencesSchema } from "@/lib/validation/email";

export const runtime = "nodejs";

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
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in to change your email preferences.", 401);
    }

    throw error;
  }

  const rate = await checkRateLimit(rateLimitPolicy("notifications:prefs", user.userId, 20, 600));

  if (!rate.allowed) {
    return jsonError("Too many preference updates. Try again shortly.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    await assertPlatformWritable(user);
  } catch (error) {
    if (error instanceof PlatformWriteBlockedError) {
      return jsonError(error.message, 503);
    }

    throw error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = notificationPreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    const prefs = await writeNotificationPrefs(user.userId, parsed.data);
    return NextResponse.json({ ok: true, prefs });
  } catch {
    return jsonError("Your preferences could not be saved. Try again.", 500);
  }
}
