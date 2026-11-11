// GCC - tournament timezone options.
//
// Dates are stored UTC plus one IANA zone chosen at creation. The list below
// is the curated set offered in forms (validated again by the server through
// `ianaTimezoneSchema`); every IANA zone remains legal, the list only keeps
// the dropdown honest and short.
import { isIanaTimezone } from "@/lib/utils/dates";

export interface TimezoneOption {
  readonly id: string;
  /** Display label with the rough UTC offset baked in for scanning. */
  readonly label: string;
}

const ZONES: readonly string[] = [
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "UTC",
];

export const DEFAULT_TOURNAMENT_TIMEZONE = "Africa/Nairobi";

function offsetLabel(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(now);

  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

/** The curated options for timezone selects, most relevant first. */
export function timezoneOptions(): readonly TimezoneOption[] {
  return ZONES.filter(isIanaTimezone).map((id) => ({
    id,
    label: `${id.replace(/_/g, " ")} (${offsetLabel(id)})`,
  }));
}

/** True when the value is offered in the curated list. */
export function isCuratedTimezone(value: string): boolean {
  return ZONES.includes(value);
}
