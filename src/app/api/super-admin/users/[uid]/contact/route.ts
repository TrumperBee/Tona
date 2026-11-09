// GCC - reveal a user's WhatsApp number.
//
// POST /api/super-admin/users/[uid]/contact
// The number is never included in page HTML or returned until this audited
// action runs. The audit entry records that a reveal happened, never the number.
import { NextResponse, type NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ uid: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "user-contact", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { uid } = await context.params;

  if (!uid || uid.includes("/")) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  const snapshot = await getFirebaseAdminFirestore().doc(paths.user(uid)).get();
  const whatsapp = snapshot.exists ? snapshot.data()?.whatsappE164 : null;

  if (!snapshot.exists || typeof whatsapp !== "string" || whatsapp.length === 0) {
    return NextResponse.json(
      { error: "No WhatsApp number is stored for this account." },
      { status: 404 },
    );
  }

  await writeAuditLog({
    actorUid: guard.user.userId,
    actorRole: guard.user.role,
    action: "user.contact_revealed",
    targetType: "user",
    targetId: uid,
    after: { contactRevealed: true },
    reason: "Super Admin viewed the private contact number.",
  });

  return NextResponse.json({ whatsapp });
}
