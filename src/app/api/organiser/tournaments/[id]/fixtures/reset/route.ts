// GCC - reset a published league-phase schedule while no result exists.
//
// POST /api/organiser/tournaments/[id]/fixtures/reset
// Deletes the matches, matchdays and zeroed standings and restores
// `pots_confirmed`. The private draft is kept so it can be published again.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { resetFixtures } from "@/lib/tournament/fixtures";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { fixturesResetSchema } from "@/lib/validation/fixtures";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "fixtures-reset", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = fixturesResetSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await resetFixtures(id, parsed.data.reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
