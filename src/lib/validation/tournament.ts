// GCC — tournament input schemas (Phase 8 wizard).
//
// Status, ownerUid, ownerTag, organisationName, slug, nameLower,
// registrationCount, maxParticipants and timestamps are never accepted from
// clients. They are assigned by the server from authenticated state and the
// tournament lifecycle rules in src/types/domain.ts. The format is fixed at
// `ucl-league-phase-36`, so no input schema contains a format field at all.
import { z } from "zod";

import { isMatchDurationMinutes, MATCH_DURATION_MINUTES_OPTIONS } from "@/lib/config/formats";
import { PLATFORMS, type PlatformId } from "@/lib/config/games";
import {
  countryCodeSchema,
  gameIdSchema,
  ianaTimezoneSchema,
  isoDateSchema,
  platformIdSchema,
} from "@/lib/validation/common";
import { COUNTRY_CODES } from "@/lib/config/countries";

export { gameIdSchema };

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;
const MAX_COUNTRY_RESTRICTIONS = 60;

/** The furthest start date the platform accepts (18 months from a moment). */
export function maxStartsAtFrom(now: Date): Date {
  return new Date(now.getTime() + 18 * MONTH_MS);
}

const httpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .pipe(
    z.url("Use a valid https image URL.").startsWith("https://", "Use a valid https image URL."),
  );

/** Step 1: basics. Saving this step creates the draft. */
export const tournamentBasicsSchema = z.strictObject({
  name: z.string().trim().min(3, "The tournament name needs at least 3 characters.").max(80),
  season: z.string().trim().min(2, "Add a season label, e.g. 2026/27.").max(40),
  gameId: gameIdSchema,
  description: z.string().trim().min(1, "Add a short description.").max(1000),
});

export type TournamentBasicsInput = z.infer<typeof tournamentBasicsSchema>;

/**
 * Wizard and settings patch. Every field is optional; the editable-fields
 * matrix decides which fields a given tournament may actually change, and
 * the server merges dates with the stored values before validating order.
 */
export const tournamentUpdateSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(3, "The tournament name needs at least 3 characters.")
      .max(80)
      .optional(),
    season: z.string().trim().min(2, "Add a season label, e.g. 2026/27.").max(40).optional(),
    gameId: gameIdSchema.optional(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(1000, "Keep the description under 1000 characters.")
      .optional(),
    rules: z.string().trim().max(4000, "Keep the rules under 4000 characters.").optional(),
    registrationOpensAt: isoDateSchema.optional(),
    registrationClosesAt: isoDateSchema.optional(),
    startsAt: isoDateSchema.optional(),
    timezone: ianaTimezoneSchema.optional(),
    coverImageUrl: httpsUrlSchema.nullable().optional(),
    logoUrl: httpsUrlSchema.nullable().optional(),
    matchDurationMinutes: z
      .number()
      .int()
      .refine(isMatchDurationMinutes, {
        message: `Match length must be one of: ${MATCH_DURATION_MINUTES_OPTIONS.join(", ")} minutes.`,
      })
      .optional(),
    allowedPlatforms: z
      .array(platformIdSchema)
      .min(1, "Allow at least one platform.")
      .refine((value) => new Set(value).size === value.length, "Each platform may appear once.")
      .optional(),
    allowedCountries: z
      .array(countryCodeSchema)
      .max(
        MAX_COUNTRY_RESTRICTIONS,
        `List at most ${MAX_COUNTRY_RESTRICTIONS} countries, or allow everyone.`,
      )
      .refine((value) => new Set(value).size === value.length, "Each country may appear once.")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one tournament field.");

export type TournamentUpdateInput = z.infer<typeof tournamentUpdateSchema>;

export interface TournamentDates {
  readonly registrationOpensAt: Date;
  readonly registrationClosesAt: Date;
  readonly startsAt: Date;
}

/** Pure date-order rules shared by the wizard UI and the server. */
export function validateTournamentDates(dates: TournamentDates): Record<string, string> {
  const errors: Record<string, string> = {};

  if (dates.registrationClosesAt.getTime() <= dates.registrationOpensAt.getTime()) {
    errors.registrationClosesAt = "Registration must close after it opens.";
  }

  if (dates.startsAt.getTime() < dates.registrationClosesAt.getTime()) {
    errors.startsAt = "The competition cannot start before registration closes.";
  }

  return errors;
}

/** The "not more than 18 months away" rule for the start date. */
export function validateStartsAtHorizon(startsAt: Date, now: Date): string | null {
  if (startsAt.getTime() > maxStartsAtFrom(now).getTime()) {
    return "The competition cannot start more than 18 months from now.";
  }

  return null;
}

/**
 * Completeness required to publish: a real description, rules and all three
 * dates. The cover image stays optional — an honest placeholder is shown
 * until the organiser uploads one.
 */
export function validatePublishCompleteness(tournament: {
  readonly description: string;
  readonly rules: string;
  readonly registrationOpensAt: Date;
  readonly registrationClosesAt: Date;
  readonly startsAt: Date;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (tournament.description.trim().length === 0) {
    errors.description = "Add a description before publishing.";
  }

  if (tournament.rules.trim().length === 0) {
    errors.rules = "Add the rules before publishing.";
  }

  Object.assign(errors, validateTournamentDates(tournament));

  return errors;
}

/** Required reason when cancelling a competition. */
export const tournamentCancelReasonSchema = z
  .string()
  .trim()
  .min(10, "Give a cancellation reason of at least 10 characters.")
  .max(500, "Keep the cancellation reason under 500 characters.");

/** Required reason when an organiser removes a player. */
export const playerRemovalReasonSchema = z
  .string()
  .trim()
  .min(5, "Give a removal reason of at least 5 characters.")
  .max(300, "Keep the removal reason under 300 characters.");

/**
 * Normalises entry restrictions for storage: every platform allowed becomes
 * `null` (no restriction) so a platform added to the config later is included
 * automatically; an empty country list means the same for countries.
 */
export function normaliseEntryRestrictions(input: {
  readonly allowedPlatforms?: readonly PlatformId[] | null;
  readonly allowedCountries?: readonly string[] | null;
}): {
  readonly allowedPlatforms: readonly PlatformId[] | null;
  readonly allowedCountries: readonly string[] | null;
} {
  const platforms = input.allowedPlatforms ?? null;
  const everyPlatformAllowed =
    platforms !== null &&
    PLATFORMS.every((platform) => (platforms as readonly PlatformId[]).includes(platform.id));

  return {
    allowedPlatforms: everyPlatformAllowed ? null : platforms,
    allowedCountries:
      input.allowedCountries && input.allowedCountries.length > 0 ? input.allowedCountries : null,
  };
}

const knownCountries = new Set(COUNTRY_CODES);

/** True when a country code exists in the platform country list. */
export function isKnownCountryCode(code: string): boolean {
  return knownCountries.has(code);
}
