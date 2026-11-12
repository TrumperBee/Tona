// GCC - canonical league-phase schedule hash.
//
// Server-only: Node's crypto module is not part of the pure engine. The hash is
// computed from a canonical text form (sorted by matchday, home id, away id), so
// the same 144 fixtures always produce the same SHA-256 regardless of Firestore
// document order. Publishing stores the hash; `verify` recomputes it from the
// stored matches and refuses to report success when the two differ.
import "server-only";

import { createHash } from "node:crypto";

export interface HashableFixture {
  readonly matchday: number;
  readonly homeId: string;
  readonly awayId: string;
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

/** Canonical, newline-terminated text form of one schedule. */
export function canonicalScheduleLines(fixtures: readonly HashableFixture[]): string[] {
  return [...fixtures]
    .sort((a, b) => {
      if (a.matchday !== b.matchday) {
        return a.matchday - b.matchday;
      }

      const home = compareText(a.homeId, b.homeId);
      return home !== 0 ? home : compareText(a.awayId, b.awayId);
    })
    .map((fixture) => `${fixture.matchday}\u0000${fixture.homeId}\u0000${fixture.awayId}`);
}

/** Canonical SHA-256 of a league-phase fixture list. */
export function canonicalScheduleHash(fixtures: readonly HashableFixture[]): string {
  const hash = createHash("sha256");

  for (const line of canonicalScheduleLines(fixtures)) {
    hash.update(line);
    hash.update("\n");
  }

  return hash.digest("hex");
}
