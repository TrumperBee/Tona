// GCC - organiser search for the ownership-transfer combobox.
//
// GET /api/super-admin/organisers?search=prefix
// Returns organisers matching a gamer-tag prefix. The role shown is display
// data only; the transfer endpoint itself verifies the real claim with the
// Admin SDK.
import { NextResponse, type NextRequest } from "next/server";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { searchOrganisers } from "@/lib/super-admin/tournaments";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  try {
    const organisers = await searchOrganisers(search);
    return NextResponse.json({ organisers });
  } catch {
    return NextResponse.json({ error: "The search could not be completed." }, { status: 500 });
  }
}
