// GCC - tournament editable-fields matrix.
//
// Pure rules for which tournament fields may change at a given point in the
// lifecycle. The PATCH route enforces them server-side and the settings UI
// uses the same set to disable controls, so the two can never drift.
//
// Matrix (Phase 8):
// - draft: everything except format (the format is fixed at creation).
// - after publish: description, rules, cover and logo always;
//   registrationClosesAt extend-only (never earlier than now);
//   startsAt not earlier than registrationClosesAt;
//   allowedPlatforms / allowedCountries only while registrationCount == 0;
//   name, game and season only while no registration exists.
// - slug is immutable from creation; formatId and maxParticipants are fixed
//   by the platform format and never accepted from a client.
// - Phase 12: the tie-break profile may change at any point until the first
//   league result is recorded. Once a result exists the stored table was built
//   with that profile, so changing it would silently rewrite history.
import type { TournamentStatus } from "@/types/domain";

export const TOURNAMENT_FIELD_IDS = [
  "name",
  "season",
  "gameId",
  "description",
  "registrationOpensAt",
  "registrationClosesAt",
  "startsAt",
  "timezone",
  "coverImageUrl",
  "logoUrl",
  "rules",
  "matchDurationMinutes",
  "allowedPlatforms",
  "allowedCountries",
  "tiebreakerProfile",
] as const;
export type TournamentFieldId = (typeof TOURNAMENT_FIELD_IDS)[number];

/** Fields locked by the format contract, never accepted in any patch. */
export const IMMUTABLE_FIELD_IDS: readonly TournamentFieldId[] = [
  "name",
  "season",
  "gameId",
  "registrationOpensAt",
];

export function isTournamentFieldId(value: string): value is TournamentFieldId {
  return (TOURNAMENT_FIELD_IDS as readonly string[]).includes(value);
}

export interface EditabilityInput {
  readonly status: TournamentStatus;
  readonly registrationCount: number;
  /** Completed league matches. The tie-break profile locks once this is > 0. */
  readonly leagueMatchesCompleted?: number;
}

/** The set of fields a patch may carry for this tournament right now. */
export function getEditableTournamentFields(
  tournament: EditabilityInput,
): ReadonlySet<TournamentFieldId> {
  if (tournament.status === "draft") {
    return new Set(TOURNAMENT_FIELD_IDS);
  }

  const editable = new Set<TournamentFieldId>([
    "description",
    "rules",
    "coverImageUrl",
    "logoUrl",
    "registrationClosesAt",
    "startsAt",
  ]);

  // The tie-break profile is part of the published table contract: changing it
  // after the first result would retroactively reorder recorded matches.
  if ((tournament.leagueMatchesCompleted ?? 0) === 0) {
    editable.add("tiebreakerProfile");
  }

  const hasRegistrations = tournament.registrationCount > 0;

  if (!hasRegistrations) {
    editable.add("name");
    editable.add("season");
    editable.add("gameId");
    editable.add("allowedPlatforms");
    editable.add("allowedCountries");
  }

  return editable;
}

export interface PatchFilterResult {
  /** True when every field in the patch is currently editable. */
  readonly ok: boolean;
  /** Offending fields, in patch order. Empty when ok. */
  readonly locked: readonly TournamentFieldId[];
}

/**
 * Filters a patch down to the fields the matrix allows. Returns the locked
 * fields so the route can report exactly which inputs were rejected.
 */
export function filterTournamentPatch(
  tournament: EditabilityInput,
  patch: Partial<Record<TournamentFieldId, unknown>>,
): PatchFilterResult {
  const editable = getEditableTournamentFields(tournament);
  const locked: TournamentFieldId[] = [];

  for (const field of Object.keys(patch) as TournamentFieldId[]) {
    if (!isTournamentFieldId(field)) continue;
    if (!editable.has(field)) {
      locked.push(field);
    }
  }

  return { ok: locked.length === 0, locked };
}

/**
 * Extend-only rule for registrationClosesAt after publication: the new value
 * must be strictly later than the stored one and not in the past.
 * Returns an error message, or null when the change is allowed.
 */
export function checkRegistrationClosesAtChange(
  current: Date,
  next: Date,
  now: Date,
): string | null {
  if (next.getTime() <= current.getTime()) {
    return "The registration deadline can only be extended, never moved earlier.";
  }

  if (next.getTime() <= now.getTime()) {
    return "The registration deadline must stay in the future.";
  }

  return null;
}

/**
 * startsAt must never move earlier than the (possibly new) registration
 * deadline. Returns an error message, or null when the change is allowed.
 */
export function checkStartsAtChange(next: Date, registrationClosesAt: Date): string | null {
  if (next.getTime() < registrationClosesAt.getTime()) {
    return "The competition cannot start before registration closes.";
  }

  return null;
}
