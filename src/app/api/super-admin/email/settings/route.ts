// GCC - announcement email switch.
//
// PATCH /api/super-admin/email/settings
// Enabling announcement email is refused when the monthly Resend reference is
// already reached, so the switch cannot promise mail the quota will silently
// drop. Other settings keep their current values.
import { NextResponse, type NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { readEmailUsage } from "@/lib/email/quota";
import { getPlatformSettings, writePlatformSettings } from "@/lib/platform/settings";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { emailAnnouncementsSchema } from "@/lib/validation/email";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "email-settings", 10, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = emailAnnouncementsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  const before = await getPlatformSettings();

  if (parsed.data.emailAnnouncements && !before.emailAnnouncements) {
    const usage = await readEmailUsage();

    if (usage.monthly.sent >= usage.monthlyLimit) {
      return NextResponse.json(
        {
          error: `The monthly email reference is used (${usage.monthly.sent}/${usage.monthlyLimit}). Announcement email cannot be enabled until it resets.`,
        },
        { status: 409 },
      );
    }
  }

  const after = await writePlatformSettings(
    {
      maintenanceMode: before.maintenanceMode,
      maintenanceMessage: before.maintenanceMessage,
      registrationsOpen: before.registrationsOpen,
      maxActiveTournamentsPerOrganiser: before.maxActiveTournamentsPerOrganiser,
      applicationCooldownDays: before.applicationCooldownDays,
      emailAnnouncements: parsed.data.emailAnnouncements,
    },
    guard.user.userId,
  );

  await writeAuditLog({
    actorUid: guard.user.userId,
    actorRole: guard.user.role,
    action: "platform.email_announcements.set",
    targetType: "platformSettings",
    targetId: "main",
    before: { emailAnnouncements: before.emailAnnouncements },
    after: { emailAnnouncements: after.emailAnnouncements },
  });

  return NextResponse.json({ ok: true, emailAnnouncements: after.emailAnnouncements });
}
