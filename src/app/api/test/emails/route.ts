import { NextResponse } from "next/server";

import { isE2EHarness, isEmailCaptureEnabled } from "@/lib/test-harness";
import { clearCapturedEmails, getCapturedEmails } from "@/lib/test-harness/email-capture";

export const runtime = "nodejs";

function guard(): NextResponse | null {
  if (process.env.GCC_E2E !== "1" || !isE2EHarness()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isEmailCaptureEnabled()) {
    return NextResponse.json({ error: "Email capture is not enabled." }, { status: 404 });
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  const denied = guard();
  if (denied) return denied;
  return NextResponse.json({ emails: getCapturedEmails() });
}

export async function DELETE(): Promise<NextResponse> {
  const denied = guard();
  if (denied) return denied;
  clearCapturedEmails();
  return NextResponse.json({ ok: true });
}
