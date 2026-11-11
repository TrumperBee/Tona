// GCC - register for a tournament.
//
// POST /api/tournaments/[id]/register
// The signed-in player enters themselves. Everything decisive (the effective
// registration state, entry restrictions, prior registrations, capacity) is
// re-checked inside one Firestore transaction in the module. The route adds
// same-origin protection and a per-player rate limit.
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { registerPlayer } from "@/lib/tournament/registrations";

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

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  // The rate limit is per player (by session uid when signed in, by IP
  // otherwise) so one caller can never exhaust another's budget.
  const user = await getCurrentUser();
  const identity = user?.userId ?? `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
  const rate = await checkRateLimit(
    rateLimitPolicy(
      "tournament-register",
      identity,
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
