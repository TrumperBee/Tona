// GCC - Super Admin cancels a tournament.
//
// POST /api/super-admin/tournaments/[id]/cancel
// Reuses the owner-facing cancellation path: required reason, notification to
// every registered player, entrants keep their records.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { cancelTournament } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { tournamentCancelReasonSchema } from "@/lib/validation/tournament";

export const runtime = "nodejs";

const cancelSchema = z.strictObject({ reason: tournamentCancelReasonSchema });

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "tournament-cancel", 20, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await cancelTournament(id, parsed.data.reason);
    return NextResponse.json({ ok: true, status: "cancelled" });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
