// GCC - reopen registration.
//
// POST /api/organiser/tournaments/[id]/reopen-registration
// Moves `registration_closed` back to `registration_open`. Structurally blocked
// once the pots are confirmed because the status has moved past that stage.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { reopenRegistration } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-reopen", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await reopenRegistration(id);
    return NextResponse.json({ ok: true, status: "registration_open" });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
