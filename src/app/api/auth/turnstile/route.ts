// GCC - verifies a Turnstile token for flows Firebase handles in the browser
// (password reset and the post-failure sign-in challenge).
//
// The client calls this before asking Firebase to send an email or accept a
// password. The action is bound into the token so a token minted for one form
// cannot be replayed on another.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import {
  TURNSTILE_FAILURE_MESSAGE,
  verifyTurnstile,
  type TurnstileAction,
} from "@/lib/security/turnstile";

export const runtime = "nodejs";

const turnstileSchema = z
  .object({
    token: z.string().trim().max(4096).optional(),
    action: z.enum(["forgot_password", "login"]),
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
  const limit = await checkRateLimit(rateLimitPolicy("auth:turnstile", ip, 30, 60));

  if (!limit.allowed) {
    return jsonError("Too many security checks. Try again shortly.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = turnstileSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid request.", 400);
  }

  const result = await verifyTurnstile({
    token: parsed.data.token,
    ip,
    action: parsed.data.action as TurnstileAction,
  });

  if (!result.ok) {
    return jsonError(TURNSTILE_FAILURE_MESSAGE, 400);
  }

  return NextResponse.json({ ok: true });
}
