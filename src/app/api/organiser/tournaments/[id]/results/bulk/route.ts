// GCC - record up to eighteen league results in one transaction.
//
// POST /api/organiser/tournaments/[id]/results/bulk
// All-or-nothing: one invalid or already-recorded match rejects the batch.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { enterMatchResultsBulk } from "@/lib/tournament/results";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { matchResultBulkSchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "results-bulk", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = matchResultBulkSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await enterMatchResultsBulk(id, parsed.data);
    return NextResponse.json({ ok: true, recorded: result.recorded });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
