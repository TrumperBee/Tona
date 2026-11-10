// GCC - reject an organiser application.
//
// POST /api/super-admin/applications/[id]/reject
// A 10-300 character note is mandatory and is copied into the applicant's
// notification and the audit entry.
import { NextResponse, type NextRequest } from "next/server";

import {
  ApplicationConflictError,
  ApplicationNotFoundError,
  rejectApplication,
} from "@/lib/applications";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { applicationRejectSchema } from "@/lib/validation/admin-application";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "application-reject", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = applicationRejectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Give the applicant a reason.",
        fieldErrors: { note: parsed.error.issues[0]?.message ?? "Give the applicant a reason." },
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid application." }, { status: 400 });
  }

  try {
    const result = await rejectApplication(guard.user, id, parsed.data.note);
    return NextResponse.json({
      ok: true,
      uid: result.uid,
      alreadyReviewed: result.alreadyReviewed,
    });
  } catch (error) {
    if (error instanceof ApplicationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ApplicationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "The application could not be rejected." }, { status: 500 });
  }
}
