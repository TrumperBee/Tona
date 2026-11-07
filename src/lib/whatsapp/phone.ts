// GCC — WhatsApp phone number helpers (E.164).
// TODO(phase 14): optionally add country-aware formatting; core validation stays server-side.

import { z } from "zod";

/** E.164: a leading +, a non-zero country digit, then 7–14 more digits. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Removes spaces, brackets, dots and hyphens. Does not add a country code. */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s().-]/g, "");
}

export function isValidE164(input: string): boolean {
  return E164_PATTERN.test(normalizePhone(input));
}

export const e164Schema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(E164_PATTERN, "Use international format, e.g. +2348012345678."));
