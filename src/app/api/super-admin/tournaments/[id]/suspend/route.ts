// GCC - Super Admin suspends a tournament.
//
// POST /api/super-admin/tournaments/[id]/suspend
// Hides the competition from every public surface while keeping its data. The
// exact stage is recorded on `suspendedFrom` so unsuspension restores it.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { suspendTournament } from "@/lib/super-admin/tournaments";
import { reasonSchema } from "@/lib/validation/super-admin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

const suspendSchema = z.strictObject({ reason: reasonSchema });

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "tournament-suspend", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = suspendSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await suspendTournament(guard.user, id, parsed.data.reason);
    return NextResponse.json({ ok: true, status: "suspended" });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
