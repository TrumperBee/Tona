// GCC - approve an organiser application.
//
// POST /api/super-admin/applications/[id]/approve
// The application is approved in a transaction, then the organiser custom
// claim is granted. A claim failure reverts the application to pending.
import { NextResponse, type NextRequest } from "next/server";

import {
  ApplicationClaimError,
  ApplicationConflictError,
  ApplicationNotFoundError,
  approveApplication,
} from "@/lib/applications";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { applicationApproveSchema } from "@/lib/validation/admin-application";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "application-approve", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown = {};

  try {
    const text = await request.text();
    body = text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = applicationApproveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the note.",
        fieldErrors: { note: parsed.error.issues[0]?.message ?? "Check the note." },
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid application." }, { status: 400 });
  }

  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

  try {
    const result = await approveApplication(guard.user, id, note);
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

    if (error instanceof ApplicationClaimError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "The application could not be approved." }, { status: 500 });
  }
}
