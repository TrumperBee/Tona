// GCC — API liveness probe.
// Intentionally does not touch the database: it reports that the app is
// serving requests. Dependency checks are added in Phase 18.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
