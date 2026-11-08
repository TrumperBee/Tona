// GCC — strict profile edit endpoint.
//
// Accepts only the fields in profileEditSchema, requires a session and a
// same-origin request, and updates the private and public documents in one
// transaction. Gamer tag and email are not editable.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { ProfileUpdateError, updatePlayerProfile } from "@/lib/profile/update";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { profileEditSchema } from "@/lib/validation/profile";

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
      return jsonError("Sign in to update your profile.", 401);
    }

    throw error;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy("profile:update", user.userId || clientIdentifier(request), 20, 600),
  );

  if (!limit.allowed) {
    return jsonError("Too many profile updates. Try again shortly.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = profileEditSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return NextResponse.json(
      { error: "Check the highlighted fields.", fieldErrors },
      { status: 400 },
    );
  }

  try {
    await updatePlayerProfile(user.userId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileUpdateError) {
      if (error.code === "invalid-whatsapp") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { whatsapp: error.message } },
          { status: 400 },
        );
      }

      return jsonError(error.message, 404);
    }

    return jsonError("We could not save your profile. Try again.", 500);
  }
}
