// GCC - account status endpoint.
//
// POST /api/super-admin/users/[uid]/status
// Suspends, bans or restores an account. Auth is disabled/enabled, refresh
// tokens are revoked, users.status and publicProfiles.status are mirrored, and
// the action is audited with a required reason.
import { NextResponse, type NextRequest } from "next/server";

import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { setAccountStatus } from "@/lib/auth/management";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { accountStatusChangeSchema } from "@/lib/validation/super-admin";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ uid: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "user-status", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = accountStatusChangeSchema.safeParse(body);

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

  const { uid } = await context.params;

  if (!uid || uid.includes("/")) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  try {
    const result = await setAccountStatus(guard.user, uid, parsed.data.status, parsed.data.reason);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes("user-not-found")) {
      return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
    }

    return NextResponse.json({ error: "The status change could not be saved." }, { status: 500 });
  }
}
