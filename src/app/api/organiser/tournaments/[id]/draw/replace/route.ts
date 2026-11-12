// GCC - replace one player in the draw.
//
// POST /api/organiser/tournaments/[id]/draw/replace
// Removes `outUid`, registers `inUid` in the same pot slot, keeps the field at
// 36 and notifies both players. Blocked once fixture work exists.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { replaceDrawPlayer } from "@/lib/tournament/draw";
import { drawReplaceSchema } from "@/lib/validation/draw";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "draw-replace", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = drawReplaceSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await replaceDrawPlayer(id, parsed.data.outUid, parsed.data.inUid, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
