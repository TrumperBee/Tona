// GCC — player profile input schemas.
import { z } from "zod";

import { countryCodeSchema, gameIdSchema, platformIdSchema } from "@/lib/validation/common";
import { e164Schema } from "@/lib/whatsapp/phone";

export const GAMER_TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{2,23}$/;

export const gamerTagSchema = z
  .string()
  .trim()
  .regex(
    GAMER_TAG_PATTERN,
    "Use 3–24 letters, numbers, spaces, dots, hyphens or underscores, starting with a letter or number.",
  )
  .transform((value) => value.replace(/\s+/g, " "));

export function normalizeGamerTag(gamerTag: string): string {
  return gamerTag.trim().replace(/\s+/g, " ").toLowerCase();
}

const profileFields = {
  fullName: z.string().trim().min(2).max(80),
  gamerTag: gamerTagSchema,
  country: countryCodeSchema,
  preferredGame: gameIdSchema,
  platform: platformIdSchema,
  photoUrl: z.url().max(500).optional(),
  whatsappE164: e164Schema.optional(),
};

export const profileCreateSchema = z.object(profileFields);

export const profileUpdateSchema = z
  .object(profileFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one profile field.");

export type ProfileCreateInput = z.infer<typeof profileCreateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
