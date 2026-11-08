// GCC - registration payload schema.
//
// Shared by the browser form and POST /api/auth/register. The server never
// trusts the client version; it parses the raw body again. WhatsApp is kept as
// raw input here and normalised with the selected country after parsing.
import { z } from "zod";

import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { gameIdSchema, platformIdSchema } from "@/lib/validation/common";
import { gamerTagSchema } from "@/lib/validation/gamer-tag";

export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(60, "Use at most 60 characters."),
  gamerTag: gamerTagSchema,
  email: emailSchema,
  password: passwordSchema,
  whatsapp: z.string().trim().max(32, "That number is too long.").optional(),
  country: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Choose a country.")),
  preferredGame: gameIdSchema,
  platform: platformIdSchema,
  acceptTerms: z.literal(true, { message: "Accept the terms and privacy policy to continue." }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
