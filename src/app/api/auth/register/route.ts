// GCC - player registration endpoint.
//
// Validation, rate limiting and gamer-tag reservation all happen on the
// server. The client signs in only after this succeeds.
import { NextResponse, type NextRequest } from "next/server";

import { RegistrationError, registerPlayer } from "@/lib/auth/registration";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { registrationSchema } from "@/lib/validation/registration";

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = registrationSchema.safeParse(body);

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

  const ipLimit = await checkRateLimit(
    rateLimitPolicy("auth:register:ip", clientIdentifier(request), 10, 3600),
  );

  if (!ipLimit.allowed) {
    return jsonError("Too many registration attempts. Try again later.", 429, {
      "Retry-After": String(ipLimit.retryAfterSeconds),
    });
  }

  const emailLimit = await checkRateLimit(
    rateLimitPolicy("auth:register:email", parsed.data.email, 5, 3600),
  );

  if (!emailLimit.allowed) {
    return jsonError("Too many registration attempts for this email. Try again later.", 429, {
      "Retry-After": String(emailLimit.retryAfterSeconds),
    });
  }

  try {
    const player = await registerPlayer(parsed.data);
    return NextResponse.json({ ok: true, gamerTag: player.gamerTag }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      if (error.code === "gamer-tag-taken") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { gamerTag: error.message } },
          { status: 409 },
        );
      }

      if (error.code === "email-in-use") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { email: error.message } },
          { status: 409 },
        );
      }

      if (error.code === "invalid-whatsapp") {
        return NextResponse.json(
          { error: error.message, fieldErrors: { whatsapp: error.message } },
          { status: 400 },
        );
      }

      return jsonError(error.message, 400);
    }

    return jsonError("We could not create your account. Try again.", 500);
  }
}
