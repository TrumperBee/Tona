// GCC - repair the league table from recorded results.
//
// POST /api/organiser/tournaments/[id]/standings/recalculate
// The owner or Super Admin may rebuild all 36 standing documents from scratch.
// This is an audited repair path for a corrupted table; it accepts no table
// values and cannot be used to enter or override a result.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { recalculateStandings } from "@/lib/tournament/standings";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "standings-recalculate", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await recalculateStandings(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
