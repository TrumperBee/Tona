// GCC - withdraw a pending organiser application.
//
// POST /api/admin-applications/[id]/withdraw
// Only the applicant can withdraw, and only while the application is pending.
import { NextResponse, type NextRequest } from "next/server";

import {
  ApplicationConflictError,
  ApplicationNotFoundError,
  withdrawApplication,
} from "@/lib/applications";
import { guardApplicantMutation } from "@/lib/applications/route-guard";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardApplicantMutation(request, "withdraw", 10, 60 * 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid application." }, { status: 400 });
  }

  try {
    await withdrawApplication(guard.user, id);
    return NextResponse.json({ ok: true, status: "withdrawn" });
  } catch (error) {
    if (error instanceof ApplicationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ApplicationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "The application could not be withdrawn." }, { status: 500 });
  }
}
