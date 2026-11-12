// GCC - a player opens a "Report a problem" report about their own result.
//
// POST /api/tournaments/[id]/matches/[matchId]/report
// Participants only, one open report per player per match, rate limited. The
// organiser is notified; no result is changed by this route.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { createResultReport } from "@/lib/tournament/result-reports";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { resultReportCreateSchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; matchId: string }>;
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

  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in to continue.", 401);
    }

    throw error;
  }

  const rate = await checkRateLimit(rateLimitPolicy("result-report:create", user.userId, 5, 60));

  if (!rate.allowed) {
    return jsonError("Too many reports. Try again shortly.", 429, {
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

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = resultReportCreateSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, matchId } = await context.params;

  if (!id || id.includes("/") || !matchId || matchId.includes("/")) {
    return jsonError("Invalid match.", 400);
  }

  try {
    const result = await createResultReport(id, matchId, parsed.data.reason, user);
    return NextResponse.json({ ok: true, reportId: result.reportId });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
