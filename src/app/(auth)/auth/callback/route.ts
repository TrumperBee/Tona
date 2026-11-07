// GCC — Firebase auth callback.
// ID-token exchange for a server session is intentionally not implemented in Phase 1B.
import { NextResponse } from "next/server";

// TODO(phase 2): verify the Firebase ID token, set the http-only session cookie
// (SESSION_COOKIE_MAX_AGE_DAYS) and redirect safely.
export function GET() {
  return NextResponse.json(
    { error: "Authentication is not implemented yet. This route is built in Phase 2." },
    { status: 501 },
  );
}
