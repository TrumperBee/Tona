// GCC - revoke organiser privileges.
//
// POST /api/super-admin/users/[uid]/role
// This is the only manual role action in Phase 5: organiser -> user. Granting
// organiser happens through the application flow in Phase 6, and no route can
// create a Super Admin.
import { NextResponse, type NextRequest } from "next/server";

import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { setUserRole } from "@/lib/auth/management";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { revokeOrganiserSchema } from "@/lib/validation/super-admin";
import { isUserRole } from "@/types/domain";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ uid: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "user-role", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = revokeOrganiserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Give a reason.",
        fieldErrors: { reason: parsed.error.issues[0]?.message ?? "Give a reason." },
      },
      { status: 400 },
    );
  }

  const { uid } = await context.params;

  if (!uid || uid.includes("/")) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  try {
    const target = await getFirebaseAdminAuth().getUser(uid);
    const claimRole = target.customClaims?.role;
    const role = isUserRole(claimRole) ? claimRole : null;

    if (role !== "organiser") {
      return NextResponse.json(
        { error: "Only an organiser can have their organiser privileges revoked." },
        { status: 400 },
      );
    }

    const result = await setUserRole(guard.user, uid, "user", parsed.data.reason);
    return NextResponse.json({ ok: true, role: result.role });
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

    return NextResponse.json({ error: "The role change could not be saved." }, { status: 500 });
  }
}
