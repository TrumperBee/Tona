// GCC - publish a tournament draft.
//
// POST /api/organiser/tournaments/[id]/publish
// Moves a draft to `registration_open`. Completeness (description, rules, the
// full schedule, a future registration deadline, a start within 18 months) is
// checked inside the transaction; nothing changes on a schedule.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { publishTournament } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-publish", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await publishTournament(id);
    return NextResponse.json({ ok: true, status: "registration_open" });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
