// GCC — player profile edit schema.
//
// PATCH /api/profile accepts ONLY these fields. Gamer tag, email, role, status,
// avatar URLs and statistics are deliberately absent: they are set by dedicated
// server flows or by the server itself. Unknown keys are rejected.
import { z } from "zod";

import { countryCodeSchema, gameIdSchema, platformIdSchema } from "@/lib/validation/common";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .pipe(z.string().max(max, `Use at most ${max} characters.`).nullable().optional());

export const profileEditSchema = z
  .strictObject({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(60, "Use at most 60 characters.")
      .optional(),
    community: optionalText(40),
    favouriteClub: optionalText(40),
    // Raw input; the server normalises it with the selected or existing country.
    whatsapp: z.string().trim().max(32, "That number is too long.").nullable().optional(),
    country: countryCodeSchema.optional(),
    preferredGame: gameIdSchema.optional(),
    platform: platformIdSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export type ProfileEditInput = z.infer<typeof profileEditSchema>;
