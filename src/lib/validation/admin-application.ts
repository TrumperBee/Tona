// GCC — Tournament Admin application schemas.
import { z } from "zod";

import { emailSchema } from "@/lib/validation/auth";
import { e164Schema } from "@/lib/whatsapp/phone";

export const adminApplicationSubmitSchema = z.object({
  communityName: z.string().trim().min(2).max(120),
  experience: z.string().trim().min(20).max(2000),
  motivation: z.string().trim().min(20).max(2000),
  expectedPlayers: z.coerce.number().int().min(2).max(1000),
  contactEmail: emailSchema,
  contactWhatsappE164: e164Schema.optional(),
});

export const adminApplicationReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(1000).optional(),
});

export type AdminApplicationSubmitInput = z.infer<typeof adminApplicationSubmitSchema>;
export type AdminApplicationReviewInput = z.infer<typeof adminApplicationReviewSchema>;
