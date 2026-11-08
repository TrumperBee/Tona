// GCC - small HTTP helpers shared by route handlers.
import { NextResponse } from "next/server";

export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  return first || request.headers.get("x-real-ip") || "unknown";
}

export function jsonError(
  message: string,
  status: number,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: message }, { status, headers });
}
