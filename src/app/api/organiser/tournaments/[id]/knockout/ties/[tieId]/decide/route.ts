// GCC - record the extra-time or penalty decider for a level knockout tie.
//
// POST /api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide
// The tie must already be level after every leg. The decider winner and any
// penalty score must agree.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { decideKnockoutTie } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { knockoutDecideSchema } from "@/lib/validation/knockout";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; tieId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "knockout-decide", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = knockoutDecideSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, tieId } = await context.params;

  if (!id || id.includes("/") || !tieId || tieId.includes("/")) {
    return NextResponse.json({ error: "Invalid knockout tie." }, { status: 400 });
  }

  try {
    const result = await decideKnockoutTie(id, tieId, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
