// GCC - Super Admin restores a suspended tournament.
//
// POST /api/super-admin/tournaments/[id]/unsuspend
// Restores the competition to the exact stage recorded on `suspendedFrom`.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { unsuspendTournament } from "@/lib/super-admin/tournaments";
import { reasonSchema } from "@/lib/validation/super-admin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

const unsuspendSchema = z.strictObject({ reason: reasonSchema });

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "tournament-unsuspend", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = unsuspendSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await unsuspendTournament(guard.user, id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
