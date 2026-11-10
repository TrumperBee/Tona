// GCC - pure organiser-application cooldown policy.
//
// A rejected applicant may reapply after `applicationCooldownDays` from the
// rejection timestamp. A withdrawn or revoked application does not start a
// cooldown. This module has no Firebase or Next.js imports so it is unit tested.
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_COOLDOWN_DAYS = 0;
export const MAX_COOLDOWN_DAYS = 90;

export interface CooldownDecision {
  readonly allowed: boolean;
  /** The first instant a new application is accepted, or null when unrestricted. */
  readonly reapplyAt: Date | null;
}

/** Normalises settings input so a bad document cannot lock or crash the flow. */
export function normaliseCooldownDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 7;
  }

  return Math.min(MAX_COOLDOWN_DAYS, Math.max(MIN_COOLDOWN_DAYS, Math.trunc(value)));
}

/** Decides whether a rejected applicant can apply again at `now`. */
export function applicationCooldown(
  lastRejectedAt: Date | null,
  cooldownDays: number,
  now: Date = new Date(),
): CooldownDecision {
  const days = normaliseCooldownDays(cooldownDays);

  if (!lastRejectedAt || days === 0) {
    return { allowed: true, reapplyAt: null };
  }

  const reapplyAt = new Date(lastRejectedAt.getTime() + days * DAY_MS);

  return {
    allowed: now.getTime() >= reapplyAt.getTime(),
    reapplyAt,
  };
}
