// GCC - organiser removes a player.
//
// POST /api/organiser/tournaments/[id]/registrations/[uid]/remove
// Requires a reason (5-300 characters). Removed players cannot re-register on
// their own; only the organiser can re-add them.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { removePlayer } from "@/lib/tournament/registrations";
import { playerRemovalReasonSchema } from "@/lib/validation/tournament";

export const runtime = "nodejs";

const removeSchema = z.strictObject({ reason: playerRemovalReasonSchema });

interface RouteContext {
  readonly params: Promise<{ id: string; uid: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "registration-remove", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = removeSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, uid } = await context.params;

  if (!id || id.includes("/") || !uid || uid.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament or player." }, { status: 400 });
  }

  try {
    await removePlayer(id, uid, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
