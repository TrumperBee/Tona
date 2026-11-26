// GCC - organiser search for the ownership-transfer combobox.
//
// GET /api/super-admin/organisers?search=prefix
// Returns organisers matching a gamer-tag prefix. The role shown is display
// data only; the transfer endpoint itself verifies the real claim with the
// Admin SDK.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireSuperAdmin } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { searchOrganisers } from "@/lib/super-admin/tournaments";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let user;

  try {
    user = await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Sign in as the Super Admin.", 401);
    }

    return jsonError("Super Admin access is required.", 403);
  }

  const rate = await checkRateLimit(
    rateLimitPolicy("super-admin:organisers:search", user.userId, 30, 60),
  );

  if (!rate.allowed) {
    return jsonError("Too many searches. Try again shortly.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  try {
    const organisers = await searchOrganisers(search);
    return NextResponse.json({ organisers });
  } catch {
    return NextResponse.json({ error: "The search could not be completed." }, { status: 500 });
  }
}
