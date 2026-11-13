// GCC - delete an unpublished knockout draft.
//
// POST /api/organiser/tournaments/[id]/knockout/reset-round
// Published rounds are immutable; this route only clears a draft so it can be
// drawn again (for example with a different leg count).
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { resetKnockoutRound } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { knockoutResetSchema } from "@/lib/validation/knockout";

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

  const parsed = knockoutResetSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await resetKnockoutRound(id, parsed.data.round, parsed.data.reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
