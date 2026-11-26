// GCC - player WhatsApp contact with the other player in a scheduled match.
//
// GET  -> suggested message for the bottom sheet (no link, no number, no write)
// POST -> wa.me link built from the recipient's E.164 number, rate limited,
//         recorded in `contactEvents` and audited
//
// The number is never rendered as text and never appears in a public document:
// it exists only inside the link returned by POST, for the one player who is
// allowed to send that message.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import {
  CONTACT_RATE_LIMIT,
  CONTACT_RATE_WINDOW_SECONDS,
  getMatchContactPreview,
  issueMatchContactLink,
} from "@/lib/contact/match-contact";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";
import { tournamentErrorResponse } from "@/lib/tournament/route-errors";
import { matchContactSchema } from "@/lib/validation/match";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ id: string; matchId: string }>;
}

async function resolveUser() {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }

    throw error;
  }
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const user = await resolveUser();

  if (!user) {
    return jsonError("Sign in to continue.", 401);
  }

  const { id, matchId } = await context.params;

  if (!id || id.includes("/") || !matchId || matchId.includes("/")) {
    return jsonError("Invalid match.", 400);
  }

  try {
    const preview = await getMatchContactPreview(id, matchId, user);
    return NextResponse.json(preview);
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    throw error;
  }

  const user = await resolveUser();

  if (!user) {
    return jsonError("Sign in to continue.", 401);
  }

  try {
    await assertPlatformWritable(user);
  } catch (error) {
    if (error instanceof PlatformWriteBlockedError) {
      return jsonError(error.message, 503);
    }

    throw error;
  }

  const rate = await checkRateLimit(
    rateLimitPolicy("match:contact", user.userId, CONTACT_RATE_LIMIT, CONTACT_RATE_WINDOW_SECONDS),
  );

  if (!rate.allowed) {
    return jsonError("Too many contact links. Try again later.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = matchContactSchema.safeParse(body);

  if (!parsed.success) {
    return tournamentErrorResponse(parsed.error);
  }

  const { id, matchId } = await context.params;

  if (!id || id.includes("/") || !matchId || matchId.includes("/")) {
    return jsonError("Invalid match.", 400);
  }

  try {
    const { link } = await issueMatchContactLink(id, matchId, user, {
      message: parsed.data.message,
      variant: parsed.data.variant,
    });
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    return tournamentErrorResponse(error);
  }
}
