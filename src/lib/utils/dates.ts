// GCC — date formatting helpers.
// Server renders in UTC by default so HTML is deterministic; user-facing
// timezone selection arrives with the tournament settings in a later phase.
// TODO(phase 8): support per-tournament timezones.

const DEFAULT_LOCALE = "en-GB";

/** Returns true when the value is an IANA time-zone identifier accepted by the runtime. */
export function isIanaTimezone(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function toDate(value: Date | string | number): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date value: ${String(value)}`);
  }

  return date;
}

export function formatDate(
  value: Date | string | number,
  options: { locale?: string; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    dateStyle: "medium",
    timeZone: options.timeZone ?? "UTC",
  }).format(toDate(value));
}

export function formatDateTime(
  value: Date | string | number,
  options: { locale?: string; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: options.timeZone ?? "UTC",
  }).format(toDate(value));
}
