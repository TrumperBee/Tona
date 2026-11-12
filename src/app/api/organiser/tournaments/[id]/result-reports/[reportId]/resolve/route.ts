// GCC - resolve or dismiss a player's result report.
//
// POST /api/organiser/tournaments/[id]/result-reports/[reportId]/resolve
// Owner or Super Admin only. The admin note is required and the reporter is
// notified with it.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { resolveResultReport } from "@/lib/tournament/result-reports";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { resultReportResolveSchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; reportId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "result-report:resolve", 30, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resultReportResolveSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, reportId } = await context.params;

  if (!id || id.includes("/") || !reportId || reportId.includes("/")) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  try {
    await resolveResultReport(id, reportId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
