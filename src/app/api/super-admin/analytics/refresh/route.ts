// GCC - refresh the cached platform analytics summary.
import { NextResponse, type NextRequest } from "next/server";

import { getAnalyticsSummary } from "@/lib/super-admin/analytics";
import { guardSuperAdminMutation } from "@/lib/super-admin/route-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdminMutation(request, "analytics-refresh", 6, 300);

  if (!guard.ok) {
    return guard.response;
  }

  try {
    const result = await getAnalyticsSummary({ force: true });
    return NextResponse.json({
      ok: true,
      generatedAt: result.summary.generatedAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Analytics could not be refreshed. Try again." },
      { status: 500 },
    );
  }
}
