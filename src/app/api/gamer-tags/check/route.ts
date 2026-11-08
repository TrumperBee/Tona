// GCC - live gamer-tag availability check.
//
// The registration transaction is the source of truth; this endpoint only
// gives immediate feedback while the player types.
import type { NextRequest } from "next/server";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { gamerTagSchema, normalizeGamerTag } from "@/lib/validation/gamer-tag";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const limit = await checkRateLimit(
    rateLimitPolicy("gamer-tags:check", clientIdentifier(request), 60, 60),
  );

  if (!limit.allowed) {
    return jsonError("Too many checks. Try again shortly.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const raw = request.nextUrl.searchParams.get("tag") ?? "";
  const parsed = gamerTagSchema.safeParse(raw);

  if (!parsed.success) {
    return Response.json({
      valid: false,
      available: false,
      error: parsed.error.issues[0]?.message ?? "That gamer tag is not valid.",
    });
  }

  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.gamerTag(normalizeGamerTag(parsed.data)))
    .get();

  return Response.json({
    valid: true,
    available: !snapshot.exists,
    error: snapshot.exists ? "That gamer tag is already taken." : undefined,
  });
}
