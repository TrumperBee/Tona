// GCC - register for a tournament.
//
// POST /api/tournaments/[id]/register
// The signed-in player enters themselves. Everything decisive (the effective
// registration state, entry restrictions, prior registrations, capacity) is
// re-checked inside one Firestore transaction in the module. The route adds
// same-origin protection and a per-player rate limit.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { registerPlayer } from "@/lib/tournament/registrations";

const paramsSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]+$/) }).strict();

export const runtime = "nodejs";

const REGISTER_RATE_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  const { id } = parsedParams.data;
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in to continue.", 401);
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
      "tournament-register",
      user.userId,
      REGISTER_RATE_LIMIT.limit,
      REGISTER_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!rate.allowed) {
    return jsonError("Too many registration attempts. Try again later.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    await registerPlayer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
