// GCC - publish the validated league-phase fixture draft.
//
// POST /api/organiser/tournaments/[id]/fixtures/publish
// Accepts eight optional informational matchday windows. Publication writes the
// 144 matches, eight matchdays and 36 zeroed standings in one transaction.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { publishFixtures } from "@/lib/tournament/fixtures";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { fixturesPublishSchema } from "@/lib/validation/fixtures";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "fixtures-publish", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = fixturesPublishSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await publishFixtures(id, parsed.data.windows);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
