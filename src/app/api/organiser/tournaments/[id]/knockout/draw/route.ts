// GCC - draw one knockout round into a private draft.
//
// POST /api/organiser/tournaments/[id]/knockout/draw
// Body: { round, legs? }. Re-drawing before publication is how the organiser
// changes the leg count for a round. A published round is immutable.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { drawKnockoutRound } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { knockoutDrawSchema } from "@/lib/validation/knockout";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "knockout-draw", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = knockoutDrawSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await drawKnockoutRound(id, parsed.data.round, parsed.data.legs);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
