// GCC - correct a recorded league result with a reason.
//
// POST /api/organiser/tournaments/[id]/results/correct
// Owner or Super Admin only. The before/after scores and the reason are audited.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { correctMatchResult } from "@/lib/tournament/results";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { matchResultCorrectionSchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "results-correct", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = matchResultCorrectionSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await correctMatchResult(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
