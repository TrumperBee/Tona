// GCC - generate the league-phase fixture draft.
//
// POST /api/organiser/tournaments/[id]/fixtures/generate
// The server generates the seed, validates the result and stores it as the
// private draft. The client sends no fixture data.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { generateFixtures } from "@/lib/tournament/fixtures";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { fixturesGenerateSchema } from "@/lib/validation/fixtures";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "fixtures-generate", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = fixturesGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await generateFixtures(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
