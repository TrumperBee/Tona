// GCC - apply an email unsubscribe.
//
// POST /api/unsubscribe
// The signed token names the user and the stream. GET never changes anything;
// this POST is the only path that writes a preference. Rate limited per IP so a
// stolen token cannot be used to hammer Firestore.
import { NextResponse, type NextRequest } from "next/server";

import { jsonError, clientIdentifier } from "@/lib/http/respond";
import { applyUnsubscribe } from "@/lib/notifications/policy";
import { readNotificationPrefs, writeNotificationPrefs } from "@/lib/notifications/preferences";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { verifyUnsubscribeToken } from "@/lib/email/tokens";
import { getEmailConfig } from "@/lib/email/config";
import { unsubscribeSchema } from "@/lib/validation/email";

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

  const rate = await checkRateLimit(
    rateLimitPolicy("email:unsubscribe", clientIdentifier(request), 10, 60),
  );

  if (!rate.allowed) {
    return jsonError("Too many attempts. Try again shortly.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = unsubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  const token = verifyUnsubscribeToken(getEmailConfig().unsubscribeSecret, parsed.data.token);

  if (!token) {
    return jsonError("This unsubscribe link is invalid or has expired.", 400);
  }

  try {
    const before = await readNotificationPrefs(token.uid);
    const after = applyUnsubscribe(before, token.category);
    await writeNotificationPrefs(token.uid, after);

    return NextResponse.json({ ok: true, category: token.category });
  } catch {
    return jsonError("Your preference could not be saved. Sign in and change it in settings.", 500);
  }
}
