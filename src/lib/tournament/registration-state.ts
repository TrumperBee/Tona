// GCC - tournament registration state.
//
// Pure decision logic shared by the server and the UI: registration is
// "effectively open" only when the stored status is `registration_open`, the
// current time is inside [registrationOpensAt, registrationClosesAt] and the
// field is not full. No clock-driven status changes exist, so this function is
// the single source of truth for what a player or a page should be told.
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

export const REGISTRATION_STATES = [
  "not_published",
  "opens_soon",
  "open",
  "full",
  "closed",
  "cancelled",
  "suspended",
] as const;
export type RegistrationState = (typeof REGISTRATION_STATES)[number];

export function isRegistrationState(value: unknown): value is RegistrationState {
  return typeof value === "string" && (REGISTRATION_STATES as readonly string[]).includes(value);
}

/** Minimal tournament shape `getRegistrationState` needs. */
export interface RegistrationStateInput {
  readonly status: TournamentStatus;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly registrationOpensAt: unknown;
  readonly registrationClosesAt: unknown;
}

function toTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  // Firestore Timestamps (client and Admin) both expose toDate().
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  if (typeof value === "string") {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  }

  return null;
}

/**
 * True while the tournament document's status itself means entries can never
 * be accepted again, regardless of dates or counts.
 */
export function isTerminalEntryStatus(status: TournamentStatus): boolean {
  return (
    status === "registration_closed" ||
    status === "pots_confirmed" ||
    status === "fixtures_published" ||
    status === "league_phase" ||
    status === "knockout" ||
    status === "completed" ||
    status === "archived"
  );
}

/**
 * True when the field has reached its capacity, regardless of the stored status
 * or registration window. This is the single capacity predicate behind
 * `getRegistrationState` and the organiser-only surfaces that manage a field
 * outside the player window.
 */
export function isFieldFull(
  tournament: Pick<RegistrationStateInput, "registrationCount" | "maxParticipants">,
): boolean {
  const count = Number.isFinite(tournament.registrationCount) ? tournament.registrationCount : 0;
  const capacity = Number.isFinite(tournament.maxParticipants) ? tournament.maxParticipants : 0;

  return count >= capacity;
}

/**
 * Computes the registration state of a tournament at a moment in time.
 *
 * - `not_published` — the competition is a draft.
 * - `opens_soon` — registration is open by status but the window has not
 *   started yet.
 * - `open` — status is `registration_open`, `now` is inside the window
 *   (inclusive on both ends) and the field is not full.
 * - `full` — the window is live but `registrationCount` has reached capacity.
 * - `closed` — the status is past `registration_open`, or the window has
 *   ended.
 * - `cancelled` / `suspended` — the platform states that stop everything.
 */
export function getRegistrationState(
  tournament: RegistrationStateInput,
  now: Date,
): RegistrationState {
  const { status } = tournament;

  if (status === "draft") {
    return "not_published";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "suspended") {
    return "suspended";
  }

  if (status !== "registration_open") {
    return "closed";
  }

  if (isFieldFull(tournament)) {
    return "full";
  }

  const opensAt = toTime(tournament.registrationOpensAt);
  const closesAt = toTime(tournament.registrationClosesAt);
  const nowMs = now.getTime();

  // A window with missing bounds cannot be honestly reported as open.
  if (opensAt === null || closesAt === null) {
    return "closed";
  }

  if (nowMs < opensAt) {
    return "opens_soon";
  }

  if (nowMs > closesAt) {
    return "closed";
  }

  return "open";
}

/** Convenience wrapper typed for full tournament documents. */
export function getTournamentRegistrationState(
  tournament: Pick<
    TournamentDocument,
    | "status"
    | "registrationCount"
    | "maxParticipants"
    | "registrationOpensAt"
    | "registrationClosesAt"
  >,
  now: Date,
): RegistrationState {
  return getRegistrationState(tournament, now);
}

/** True when a player may enter right now. */
export function isRegistrationOpen(tournament: RegistrationStateInput, now: Date): boolean {
  return getRegistrationState(tournament, now) === "open";
}

/**
 * The next moment a viewer should count down to, or null when there is
 * nothing upcoming (registration over, competition running or finished).
 */
export function nextCountdownTarget(
  tournament: RegistrationStateInput,
  now: Date,
): { readonly label: string; readonly at: number } | null {
  const state = getRegistrationState(tournament, now);

  if (state === "opens_soon") {
    return { label: "Registration opens", at: toTime(tournament.registrationOpensAt) ?? 0 };
  }

  if (state === "open") {
    return { label: "Registration closes", at: toTime(tournament.registrationClosesAt) ?? 0 };
  }

  return null;
}
