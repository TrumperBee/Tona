// GCC - tournament logo upload.
//
// POST /api/organiser/tournaments/[id]/logo
// Receives image bytes, uploads to Cloudinary under
// gcc/tournaments/{id}/logo with server credentials and stores the reference
// through the editable-fields matrix. The browser never supplies a URL.
import type { NextRequest, NextResponse } from "next/server";

import { handleTournamentImageUpload } from "@/lib/tournament/image-route";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return handleTournamentImageUpload(request, context, "logo");
}
