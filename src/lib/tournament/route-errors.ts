// GCC - error mapping for tournament mutation routes.
//
// Domain failures map to honest status codes with per-field messages; an
// ownership failure renders the same 404 as a missing tournament so no
// competition's existence leaks through the API.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { PlatformWriteBlockedError } from "@/lib/platform/settings";
import { TournamentMutationError } from "@/lib/tournament/errors";

/** Maps one thrown error from a tournament mutation module to a response. */
export function tournamentErrorResponse(error: unknown): NextResponse {
  if (error instanceof TournamentMutationError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(Object.keys(error.fields).length > 0 ? { fields: error.fields } : {}),
      },
      { status: error.status },
    );
  }

  if (error instanceof AuthorizationError || error instanceof NotFoundError) {
    // Not owned (or not real): identical 404, no existence leak.
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  if (error instanceof PlatformWriteBlockedError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Check the highlighted fields.",
        fields: Object.fromEntries(
          error.issues
            .filter((issue) => issue.path.length > 0)
            .map((issue) => [String(issue.path[0]), issue.message]),
        ),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
