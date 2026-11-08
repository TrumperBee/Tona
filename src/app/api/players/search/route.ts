// GCC - public player search by gamer-tag prefix.
//
// Only public-profile fields are returned. The query uses gamerTagLower, which
// is a lower-case copy of the display tag.
import type { NextRequest } from "next/server";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import type { PublicProfileDocument } from "@/types/domain";

export const runtime = "nodejs";

const MAX_RESULTS = 20;

export async function GET(request: NextRequest): Promise<Response> {
  const limit = await checkRateLimit(
    rateLimitPolicy("players:search", clientIdentifier(request), 30, 60),
  );

  if (!limit.allowed) {
    return jsonError("Too many searches. Try again shortly.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  if (query.length < 2) {
    return Response.json({ players: [] });
  }

  if (query.length > 24) {
    return Response.json({ players: [] });
  }

  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.publicProfiles())
    .where("gamerTagLower", ">=", query)
    .where("gamerTagLower", "<=", `${query}\uf8ff`)
    .orderBy("gamerTagLower")
    .limit(MAX_RESULTS)
    .get();

  const players = snapshot.docs.map((document) => {
    const data = document.data() as PublicProfileDocument;

    return {
      uid: document.id,
      gamerTag: data.gamerTag,
      country: data.country,
      preferredGame: data.preferredGame,
      avatarUrl: data.avatarUrl ?? null,
    };
  });

  return Response.json({ players });
}
