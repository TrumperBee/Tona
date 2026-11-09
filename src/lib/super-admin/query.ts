// GCC - Super Admin query helpers.
//
// Lists use opaque document-id cursors rather than page offsets so a new record
// never shifts a reader onto a duplicate or skipped row.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 25;

export function firstQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePageSize(value: string | string[] | undefined): number {
  const raw = Number.parseInt(firstQueryValue(value) ?? "", 10);

  if (!Number.isFinite(raw)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(5, raw));
}

/** Parses a `yyyy-mm-dd` date input into the start of that UTC day. */
export function parseDateStart(value: string | string[] | undefined): Date | null {
  const raw = firstQueryValue(value);

  if (!raw) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (!match) {
    return null;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parses a `yyyy-mm-dd` date input into the exclusive end of that UTC day. */
export function parseDateEnd(value: string | string[] | undefined): Date | null {
  const start = parseDateStart(value);

  if (!start) {
    return null;
  }

  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function toTimestampOrNull(value: Date | null): Timestamp | null {
  return value ? Timestamp.fromDate(value) : null;
}
