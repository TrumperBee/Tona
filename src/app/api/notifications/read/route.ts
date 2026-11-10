// GCC - mark notifications as read.
//
// POST /api/notifications/read
// The owner is always the verified session UID. A caller may name up to 50 of
// their own notification ids or mark every unread notification as read.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, AuthorizationError, requireVerifiedUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { markNotificationsRead } from "@/lib/notifications";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { markNotificationsReadSchema } from "@/lib/validation/notification";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    user = await requireVerifiedUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in to continue.", 401);
    }

    if (error instanceof AuthorizationError) {
      return jsonError(error.message, 403);
    }

    throw error;
  }

  const rate = await checkRateLimit(rateLimitPolicy("notifications:read", user.userId, 60, 60));

  if (!rate.allowed) {
    return jsonError("Too many notification updates. Try again shortly.", 429, {
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
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = markNotificationsReadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    const updated = await markNotificationsRead(user.userId, parsed.data);
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ error: "Notifications could not be updated." }, { status: 500 });
  }
}
