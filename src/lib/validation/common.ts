// GCC — shared Zod primitives for server-accepted domain payloads.
import { z } from "zod";

import type { GameId, PlatformId } from "@/lib/config/games";
import { isGameId, PLATFORMS } from "@/lib/config/games";
import { isIanaTimezone } from "@/lib/utils/dates";

export const gameIdSchema = z
  .string()
  .trim()
  .refine(isGameId, "Unsupported game.")
  .transform((value) => value as GameId);

const platformIds = new Set<string>(PLATFORMS.map((platform) => platform.id));

export const platformIdSchema = z
  .string()
  .trim()
  .refine((value) => platformIds.has(value), "Unsupported platform.")
  .transform((value) => value as PlatformId);

export const countryCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter ISO 3166-1 country code."));

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .refine(isIanaTimezone, "Use a valid IANA time zone, e.g. Africa/Nairobi.");

/** Accepts an ISO-8601 string or Date and returns a Date. */
export const isoDateSchema = z.coerce.date();

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.");
