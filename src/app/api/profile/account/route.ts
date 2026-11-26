// GCC — self-service account deletion.
//
// DELETE /api/profile/account
// Requires a same-origin request and a Firebase sign-in within the last ten
// minutes. The session is cleared once the deletion succeeds; the browser then
// signs out of the Firebase client session as well.
import { NextResponse, type NextRequest } from "next/server";

import { AccountDeletionError, deleteOwnAccount } from "@/lib/account/delete-account";
import { AuthenticationError, requireFreshSession } from "@/lib/auth/guards";
import { clearSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const ACCOUNT_DELETION_LIMIT = { limit: 3, windowSeconds: 60 * 60 } as const;

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  let user;

  try {
    user = await requireFreshSession(undefined, "deleting your account");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError(error.message, 401);
    }

    throw error;
  }

  try {
    await assertPlatformWritable(user);
  } catch (error) {
    if (error instanceof PlatformWriteBlockedError) {
      return jsonError(error.message, 503);
    }

    throw error;
  }

  // Bound repeated attempts per signed-in user. The counter is keyed by the
  // verified uid, never by a client-supplied identifier, and is consumed only
  // after the session and platform checks pass.
  const rate = await checkRateLimit(
    rateLimitPolicy(
      "profile:account-delete",
      user.userId,
      ACCOUNT_DELETION_LIMIT.limit,
      ACCOUNT_DELETION_LIMIT.windowSeconds,
    ),
  );

  if (!rate.allowed) {
    return jsonError("Too many deletion attempts. Try again later.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  try {
    const result = await deleteOwnAccount(user);
    const response = NextResponse.json({ ok: true, deleted: true, signedOut: true, ...result });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Account deletion failed", error);
    return jsonError("We could not delete your account. Try again or contact the GCC team.", 500);
  }
}
