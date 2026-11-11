// GCC - zoned date helpers for tournament forms.
//
// The platform stores every instant in UTC plus the competition's IANA
// timezone. Datetime-local inputs are "naive" (no offset): the organiser
// types wall-clock times in the competition timezone, and these helpers
// convert between that representation and UTC. Pure logic — no server imports
// — so the wizard, the settings editor and unit tests all share it.

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function read(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const by = new Map<string, string>(parts.map((part) => [part.type, part.value]));
  const number = (type: string): number => Number(by.get(type) ?? 0);

  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
    second: number("second"),
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = read(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

const NAIVE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isNaiveDateTime(value: string): boolean {
  return NAIVE_PATTERN.test(value);
}

/**
 * Converts a naive `yyyy-mm-ddThh:mm` wall-clock time in `timeZone` to an ISO
 * UTC string. Two passes absorb DST boundaries.
 */
export function zonedToUtcIso(naive: string, timeZone: string): string {
  if (!isNaiveDateTime(naive)) {
    throw new RangeError(`Not a naive datetime value: ${naive}`);
  }

  const [datePart, timePart] = naive.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = zoneOffsetMs(new Date(guess.getTime() - zoneOffsetMs(guess, timeZone)), timeZone);

  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset).toISOString();
}

/**
 * Renders a UTC ISO string as the naive wall-clock `yyyy-mm-ddThh:mm` inside
 * `timeZone` — the inverse of `zonedToUtcIso` and the value a
 * datetime-local input expects.
 */
export function utcIsoToZonedNaive(iso: string, timeZone: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a valid instant: ${iso}`);
  }

  const parts = read(date, timeZone);
  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

  return (
    `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}` +
    `T${pad(parts.hour)}:${pad(parts.minute)}`
  );
}
