// GCC - WhatsApp contact link for one registered player.
//
// GET /api/organiser/tournaments/[id]/registrations/[uid]/contact
// Returns a wa.me click-to-chat link with a generic pre-filled message. The
// player's phone number is used to build the link server-side and is never
// returned to the browser. Every issuance is audited.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import { issueRegistrationContactLink } from "@/lib/organiser/registrations";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; uid: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, "registration-contact", 30, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const { id, uid } = await context.params;

  if (!id || id.includes("/") || !uid || uid.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament or player." }, { status: 400 });
  }

  try {
    const { link } = await issueRegistrationContactLink(id, uid);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
