// GCC - create a platform announcement.
import { NextResponse, type NextRequest } from "next/server";

import { createAnnouncement } from "@/lib/super-admin/announcements";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";
import { announcementCreateSchema } from "@/lib/validation/announcement";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "announcement-create", 20, 60);

  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = announcementCreateSchema.safeParse(body);

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

  const result = await createAnnouncement(guard.user, parsed.data);
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
