// GCC - edit or soft-delete a platform announcement.
import { NextResponse, type NextRequest } from "next/server";

import {
  AnnouncementNotFoundError,
  softDeleteAnnouncement,
  updateAnnouncement,
} from "@/lib/super-admin/announcements";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { announcementContentSchema } from "@/lib/validation/announcement";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function invalidId(): NextResponse {
  return NextResponse.json({ error: "Invalid announcement." }, { status: 400 });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "announcement-edit", 30, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return invalidId();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = announcementContentSchema.safeParse(body);

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
    await updateAnnouncement(guard.user, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AnnouncementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "The announcement could not be saved." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "announcement-delete", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return invalidId();
  }

  try {
    await softDeleteAnnouncement(guard.user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AnnouncementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "The announcement could not be deleted." }, { status: 500 });
  }
}
