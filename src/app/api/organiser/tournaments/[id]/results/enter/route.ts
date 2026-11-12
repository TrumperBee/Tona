// GCC - record one league match result.
//
// POST /api/organiser/tournaments/[id]/results/enter
// Owner or Super Admin only. The match id, scores and tournament scope are
// validated before the transaction begins.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { enterMatchResult } from "@/lib/tournament/results";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { matchResultEntrySchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "results-enter", 30, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = matchResultEntrySchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    await enterMatchResult(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
