// GCC — strict organiser profile edit endpoint.
//
// Accepts only the fields in organiserProfileEditSchema, requires an organiser
// (or Super Admin) session and a same-origin request, and writes the single
// public organiser document. The uid, logo references and timestamps are never
// accepted from the body.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, AuthorizationError, requireRole } from "@/lib/auth/guards";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import {
  auditOrganiserProfileUpdate,
  OrganiserProfileError,
  updateOrganiserProfile,
} from "@/lib/organiser/profile";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { organiserProfileEditSchema } from "@/lib/validation/organiser-profile";

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
    user = await requireRole("organiser");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in to edit your organiser profile.", 401);
    }

    if (error instanceof AuthorizationError) {
      return jsonError("Organiser access is required.", 403);
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

  const limit = await checkRateLimit(
    rateLimitPolicy("organiser:profile:update", user.userId || clientIdentifier(request), 20, 600),
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

  const parsed = organiserProfileEditSchema.safeParse(body);

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
    const profile = await updateOrganiserProfile(user.userId, parsed.data);
    await auditOrganiserProfileUpdate(user);

    return NextResponse.json({ ok: true, organisationName: profile.organisationName });
  } catch (error) {
    if (error instanceof OrganiserProfileError) {
      if (error.code === "name-required") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { organisationName: error.message } },
          { status: 400 },
        );
      }

      return jsonError(error.message, 404);
    }

    return jsonError("We could not save your organiser profile. Try again.", 500);
  }
}
