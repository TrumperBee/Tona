// GCC - publish a platform announcement.
import { NextResponse, type NextRequest } from "next/server";

import { AnnouncementNotFoundError, publishAnnouncement } from "@/lib/super-admin/announcements";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "announcement-publish", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid announcement." }, { status: 400 });
  }

  try {
    await publishAnnouncement(guard.user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AnnouncementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "The announcement could not be published." },
      { status: 500 },
    );
  }
}
