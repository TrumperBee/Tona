// GCC - platform settings endpoint.
//
// PATCH /api/super-admin/settings replaces the single settings document after a
// strict validation, a maintenance confirmation reason and an audit entry with
// the before/after values.
import { NextResponse, type NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { getPlatformSettings, writePlatformSettings } from "@/lib/platform/settings";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { platformSettingsSchema } from "@/lib/validation/platform-settings";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "settings", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = platformSettingsSchema.safeParse(body);

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

  const before = await getPlatformSettings();
  const input = parsed.data;

  if (before.maintenanceMode !== input.maintenanceMode && !input.reason) {
    return NextResponse.json(
      {
        error: "Give a reason before changing maintenance mode.",
        fieldErrors: { reason: "A reason is required for this change." },
      },
      { status: 400 },
    );
  }

  const after = await writePlatformSettings(
    {
      maintenanceMode: input.maintenanceMode,
      maintenanceMessage: input.maintenanceMessage,
      registrationsOpen: input.registrationsOpen,
      maxActiveTournamentsPerOrganiser: input.maxActiveTournamentsPerOrganiser,
      applicationCooldownDays: input.applicationCooldownDays,
    },
    guard.user.userId,
  );

  await writeAuditLog({
    actorUid: guard.user.userId,
    actorRole: guard.user.role,
    action: "platform.settings.updated",
    targetType: "platformSettings",
    targetId: "main",
    before: {
      maintenanceMode: before.maintenanceMode,
      maintenanceMessage: before.maintenanceMessage,
      registrationsOpen: before.registrationsOpen,
      maxActiveTournamentsPerOrganiser: before.maxActiveTournamentsPerOrganiser,
      applicationCooldownDays: before.applicationCooldownDays,
    },
    after: {
      maintenanceMode: after.maintenanceMode,
      maintenanceMessage: after.maintenanceMessage,
      registrationsOpen: after.registrationsOpen,
      maxActiveTournamentsPerOrganiser: after.maxActiveTournamentsPerOrganiser,
      applicationCooldownDays: after.applicationCooldownDays,
    },
    reason: input.reason ?? null,
  });

  return NextResponse.json({
    ok: true,
    settings: {
      ...after,
      updatedAt: after.updatedAt?.toISOString() ?? null,
    },
  });
}
