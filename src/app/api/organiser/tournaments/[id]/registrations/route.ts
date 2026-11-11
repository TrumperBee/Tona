// GCC - organiser adds a player directly.
//
// POST /api/organiser/tournaments/[id]/registrations
// The organiser (or Super Admin) enters a player by uid. The registration
// window is ignored, but capacity, the stored status (before pots) and entry
// restrictions still apply, and a player who withdrew or was removed may be
// re-added by the organiser only.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { addPlayer } from "@/lib/tournament/registrations";

export const runtime = "nodejs";

const addPlayerSchema = z.strictObject({
  uid: z.string().trim().min(1, "Choose a player to add.").max(128),
});

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "registration-add", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addPlayerSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await addPlayer(id, parsed.data.uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
