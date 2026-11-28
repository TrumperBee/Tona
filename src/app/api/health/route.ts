// GCC - API liveness probe.
// Intentionally does not touch the database: it reports that the app is
// serving requests. Deep dependency checks are Super Admin only at /api/health/deep.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", checkedAt: new Date().toISOString() });
}
