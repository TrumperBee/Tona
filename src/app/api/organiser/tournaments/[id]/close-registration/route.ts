// GCC - close registration early.
//
// POST /api/organiser/tournaments/[id]/close-registration
// Moves `registration_open` to `registration_closed`. The stored deadline
// keeps its meaning for history; the effective state players see flips to
// closed immediately.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { closeRegistration } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-close", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await closeRegistration(id);
    return NextResponse.json({ ok: true, status: "registration_closed" });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
