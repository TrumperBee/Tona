// GCC - reset an unplayed knockout bracket.
//
// POST /api/organiser/tournaments/[id]/knockout/reset
// Body: { reason }. Allowed only while no knockout tie or leg has a result.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { resetKnockoutStage } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { knockoutResetStageSchema } from "@/lib/validation/knockout";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "knockout-reset", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = knockoutResetStageSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await resetKnockoutStage(id, parsed.data.reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
