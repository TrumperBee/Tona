// GCC - create a tournament draft.
//
// POST /api/organiser/tournaments
// Wizard step 1 backs this: the basics create the draft (name, season, game,
// description). The slot limit and the immutable slug reservation are enforced
// inside the creation transaction in the module.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { createTournamentDraft } from "@/lib/tournament/create";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { tournamentBasicsSchema } from "@/lib/validation/tournament";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-create", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = tournamentBasicsSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  try {
    const created = await createTournamentDraft(guard.user, parsed.data);

    return NextResponse.json(
      { ok: true, tournamentId: created.tournamentId, slug: created.slug },
      { status: 201 },
    );
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
