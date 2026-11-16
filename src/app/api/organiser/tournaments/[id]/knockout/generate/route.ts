// GCC - generate the complete knockout bracket.
//
// POST /api/organiser/tournaments/[id]/knockout/generate
// Body: { legs }. The server re-reads the 144 league results, freezes the table,
// draws and validates all 23 ties and creates the matches whose participants
// are already known. Calling it twice returns the stored bracket.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { generateKnockoutStage } from "@/lib/tournament/knockout";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { knockoutGenerateSchema } from "@/lib/validation/knockout";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "knockout-generate", 5, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = knockoutGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const result = await generateKnockoutStage(id, parsed.data.legs);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
