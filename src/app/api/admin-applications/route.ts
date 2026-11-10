// GCC - submit an organiser application.
//
// POST /api/admin-applications
// The applicant must be a signed-in, email-verified participant. The server
// snapshots identity, enforces one pending application and the post-rejection
// cooldown inside a transaction, then notifies the Super Admin and audits it.
import { NextResponse, type NextRequest } from "next/server";

import {
  ApplicationCooldownError,
  ApplicationConflictError,
  ApplicationInputError,
  submitApplication,
} from "@/lib/applications";
import { guardApplicantMutation } from "@/lib/applications/route-guard";
import { adminApplicationSubmitSchema } from "@/lib/validation/admin-application";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardApplicantMutation(request, "submit", 5, 60 * 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = adminApplicationSubmitSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return NextResponse.json(
      { error: "Check the highlighted fields.", fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await submitApplication(guard.user, parsed.data);
    return NextResponse.json({ ok: true, id: result.id, status: result.status }, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationCooldownError) {
      return NextResponse.json(
        {
          error: error.message,
          reapplyAt: error.reapplyAt.toISOString(),
        },
        { status: 409 },
      );
    }

    if (error instanceof ApplicationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ApplicationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "The application could not be saved." }, { status: 500 });
  }
}
