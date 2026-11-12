// GCC - shuffle the field into four pots.
//
// POST /api/organiser/tournaments/[id]/draw/shuffle
// The seed is always generated on the server; a client may only send the pins
// it already owns. Confirmed draws cannot be re-shuffled.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { shuffleDraw } from "@/lib/tournament/draw";
import { drawShuffleSchema } from "@/lib/validation/draw";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "draw-shuffle", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = drawShuffleSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await shuffleDraw(id, parsed.data.locked ?? {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
