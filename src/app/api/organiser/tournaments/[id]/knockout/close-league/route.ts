// GCC - close the league phase and open the knockout.
//
// POST /api/organiser/tournaments/[id]/knockout/close-league
// Refused until all 144 league results are recorded. Standings freeze here.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { closeLeaguePhase } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "knockout-close-league", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await closeLeaguePhase(id);
    return NextResponse.json({
      ok: true,
      closedAt: result.closedAt.toDate().toISOString(),
    });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
