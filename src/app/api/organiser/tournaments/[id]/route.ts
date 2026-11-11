// GCC - update or delete a tournament.
//
// PATCH /api/organiser/tournaments/[id]
// DELETE /api/organiser/tournaments/[id]
// The patch honours the editable-fields matrix inside a transaction against a
// fresh read. Delete only works for a never-published draft and releases the
// slug in the same transaction.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { deleteTournamentDraft } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { updateTournament } from "@/lib/tournament/update";
import { tournamentUpdateSchema } from "@/lib/validation/tournament";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-update", 30, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = tournamentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await updateTournament(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-delete", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await deleteTournamentDraft(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
