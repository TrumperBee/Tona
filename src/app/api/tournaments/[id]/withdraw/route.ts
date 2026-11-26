// GCC - withdraw from a tournament.
//
// POST /api/tournaments/[id]/withdraw
// The signed-in player withdraws their own entry. Possible while the stored
// status is still `registration_open` — the pots are never confirmed before
// that stage — even if the window has ended or the field has filled.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { withdrawPlayer } from "@/lib/tournament/registrations";

const paramsSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]+$/) }).strict();

export const runtime = "nodejs";

const WITHDRAW_RATE_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

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
      "tournament-withdraw",
      user.userId,
      WITHDRAW_RATE_LIMIT.limit,
      WITHDRAW_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!rate.allowed) {
    return jsonError("Too many withdrawal attempts. Try again later.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    await withdrawPlayer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
