// GCC — tournament input schemas.
//
// Status, ownerUid, registrationCount and timestamps are never accepted from
// clients. They are assigned by the server from authenticated state and the
// tournament lifecycle rules in src/types/domain.ts.
import { z } from "zod";

import { getTournamentFormat, type TournamentFormatId } from "@/lib/config/formats";
import {
  gameIdSchema,
  ianaTimezoneSchema,
  isoDateSchema,
  slugSchema,
} from "@/lib/validation/common";
import { slugify } from "@/lib/utils/slug";

export { gameIdSchema };

export const tournamentFormatIdSchema = z
  .string()
  .trim()
  .refine((value) => getTournamentFormat(value) !== undefined, "Unsupported competition format.")
  .transform((value) => value as TournamentFormatId);

const tournamentFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(2000).optional(),
  gameId: gameIdSchema,
  formatId: tournamentFormatIdSchema,
  slug: slugSchema.optional(),
  coverImageUrl: z.string().trim().max(500).pipe(z.url()).optional(),
  rules: z.string().trim().max(10000).optional(),
  matchDurationMinutes: z.coerce.number().int().min(1).max(180).default(90),
  timezone: ianaTimezoneSchema.default("Africa/Nairobi"),
  registrationOpensAt: isoDateSchema,
  registrationClosesAt: isoDateSchema,
  startsAt: isoDateSchema,
  maxParticipants: z.coerce.number().int().min(2).max(36).default(36),
  season: z.string().trim().min(2).max(40),
};

function validateDateOrder(value: {
  registrationOpensAt?: Date;
  registrationClosesAt?: Date;
  startsAt?: Date;
}): boolean {
  const { registrationOpensAt, registrationClosesAt, startsAt } = value;

  if (registrationOpensAt && registrationClosesAt && registrationOpensAt >= registrationClosesAt) {
    return false;
  }

  if (registrationClosesAt && startsAt && registrationClosesAt >= startsAt) {
    return false;
  }

  return true;
}

export const tournamentCreateSchema = z.object(tournamentFields).superRefine((value, context) => {
  if (!validateDateOrder(value)) {
    context.addIssue({
      code: "custom",
      path: ["registrationClosesAt"],
      message: "Registration must open before it closes, and close before the tournament starts.",
    });
  }
});

export const tournamentUpdateSchema = z
  .object(tournamentFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one tournament field.")
  .refine(validateDateOrder, {
    message: "Registration must open before it closes, and close before the tournament starts.",
  });

export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>;
export type TournamentUpdateInput = z.infer<typeof tournamentUpdateSchema>;

/** Derives a default slug suggestion; uniqueness is enforced by the server. */
export function suggestTournamentSlug(name: string): string {
  return slugify(name);
}
