// GCC - clear the draft draw.
//
// POST /api/organiser/tournaments/[id]/draw/clear
// Every player returns to the unassigned column; saved pins are released.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { clearDraw } from "@/lib/tournament/draw";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "draw-clear", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await clearDraw(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
