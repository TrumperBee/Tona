// GCC - cancel a tournament.
//
// POST /api/organiser/tournaments/[id]/cancel
// Requires a reason (10-500 characters). Registered players are notified
// best-effort after the commit; entrants keep their records, and the
// competition leaves every public list while its page keeps showing the
// cancellation notice.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { cancelTournament } from "@/lib/tournament/lifecycle";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { tournamentCancelReasonSchema } from "@/lib/validation/tournament";

export const runtime = "nodejs";

const cancelSchema = z.strictObject({ reason: tournamentCancelReasonSchema });

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "tournament-cancel", 10, 3600);

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
