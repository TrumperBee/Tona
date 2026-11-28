import { NextResponse } from "next/server";

import { isE2EHarness } from "@/lib/test-harness";
import { seedQaWorld } from "@/lib/test-harness/seed-world";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.GCC_E2E !== "1" || !isE2EHarness()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const result = await seedQaWorld();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}
