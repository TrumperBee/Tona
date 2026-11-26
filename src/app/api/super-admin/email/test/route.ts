// GCC - send a Super Admin test email.
//
// POST /api/super-admin/email/test
// The message always goes to the signed-in Super Admin, never to an address in
// the request body, so the endpoint cannot be used to send mail elsewhere.
import { NextResponse, type NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { sendTestEmail } from "@/lib/email/operations";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "email-test", 5, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  if (!guard.user.email) {
    return NextResponse.json(
      { error: "The Super Admin account has no email address." },
      { status: 400 },
    );
  }

  const outcome = await sendTestEmail(guard.user.email);

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.reason }, { status: 502 });
  }

  await writeAuditLog({
    actorUid: guard.user.userId,
    actorRole: guard.user.role,
    action: "email.test.sent",
    targetType: "email",
    targetId: guard.user.userId,
  });

  return NextResponse.json({ ok: true, simulated: outcome.simulated });
}
