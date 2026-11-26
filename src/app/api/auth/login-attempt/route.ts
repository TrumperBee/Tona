// GCC - sign-in challenge state.
//
// The browser asks whether a Turnstile challenge is required after repeated
// failures, then reports failures and successes. Keys are IP + SHA-256(email),
// so no readable address is written. Firebase Auth remains the credential
// authority; this route only gates the form.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  clearLoginFailures,
  loginFailureCount,
  recordLoginFailure,
} from "@/lib/auth/login-attempts";
import { emailSchema } from "@/lib/validation/auth";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const attemptSchema = z
  .object({
    email: emailSchema,
    event: z.enum(["check", "failed", "success"]),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  const ip = clientIdentifier(request);
  const limit = await checkRateLimit(rateLimitPolicy("auth:login-attempt", ip, 60, 60));

  if (!limit.allowed) {
    return jsonError("Too many attempts. Try again shortly.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = attemptSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid request.", 400);
  }

  const { email, event } = parsed.data;

  if (event === "check") {
    const count = await loginFailureCount(ip, email);
    return NextResponse.json({ challengeRequired: count >= 3 });
  }

  if (event === "success") {
    await clearLoginFailures(ip, email);
    return NextResponse.json({ challengeRequired: false });
  }

  return NextResponse.json(await recordLoginFailure(ip, email));
}
