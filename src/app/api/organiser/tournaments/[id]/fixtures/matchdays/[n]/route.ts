// GCC - edit one published matchday window.
//
// PATCH /api/organiser/tournaments/[id]/fixtures/matchdays/[n]
// Windows are informational and may change after publication. Results are never
// touched.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { updateMatchdayWindow } from "@/lib/tournament/fixtures";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { fixtureMatchdayUpdateSchema } from "@/lib/validation/fixtures";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; n: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "fixtures-matchday", 60, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = fixtureMatchdayUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, n } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  const matchday = Number(n);

  if (!Number.isInteger(matchday) || matchday < 1 || matchday > 8) {
    return NextResponse.json(
      { error: "A matchday number must be between 1 and 8." },
      { status: 400 },
    );
  }

  try {
    const result = await updateMatchdayWindow(
      id,
      matchday,
      parsed.data.startsOn,
      parsed.data.endsOn,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
