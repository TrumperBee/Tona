// GCC - CSV export of the registered field.
//
// GET /api/organiser/tournaments/[id]/registrations/export
// Owner only. Columns: gamer tag, full name, country, platform, entry time.
// No phone numbers or email addresses are ever included.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { exportTournamentRegistrationsCsv } from "@/lib/organiser/registrations";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "registration-export", 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  try {
    const { filename, csv } = await exportTournamentRegistrationsCsv(id);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
