// GCC - undo a draw confirmation.
//
// POST /api/organiser/tournaments/[id]/draw/unconfirm
// Only while the tournament is `pots_confirmed` and no fixture draft or match
// exists. Returns the draw to draft and the tournament to `registration_closed`.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { unconfirmDraw } from "@/lib/tournament/draw";
import { drawUnconfirmSchema } from "@/lib/validation/draw";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "draw-unconfirm", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = drawUnconfirmSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await unconfirmDraw(id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
