// GCC - request-cached tournament workspace access.
//
// The workspace layout and every tab page need the same guarded read; React's
// per-request cache keeps that to one guard verification and one Firestore
// document fetch per render.
import "server-only";

import { cache } from "react";

import { requireTournamentOwnerOrSuperAdmin, type TournamentAccess } from "@/lib/auth/guards";

export const getTournamentWorkspace = cache((tournamentId: string): Promise<TournamentAccess> =>
  requireTournamentOwnerOrSuperAdmin(tournamentId),
);
