// GCC - organiser application input schemas.
//
// The browser is advisory; the submission route parses this strict schema again
// before writing anything. Identity, email, status and reviewer fields are never
// accepted from the client.
import { z } from "zod";

import { GAMES } from "@/lib/config/games";
import { gameIdSchema } from "@/lib/validation/common";
import { COMMUNITY_TYPES, EXPECTED_PLAYER_RANGES } from "@/types/domain";

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(300, "Use 300 characters or fewer.")
  .refine(isHttpsUrl, "Enter a valid https:// link.");

const optionalCommunityLink = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? null : value),
  z.union([httpsUrlSchema, z.null()]).optional(),
);

export const adminApplicationSubmitSchema = z
  .object({
    communityName: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters.")
      .max(60, "Use 60 characters or fewer."),
    communityType: z.enum(COMMUNITY_TYPES, { error: "Choose a community type." }),
    communityLink: optionalCommunityLink,
    expectedPlayers: z.enum(EXPECTED_PLAYER_RANGES, {
      error: "Choose an expected player range.",
    }),
    gamesPlanned: z
      .array(gameIdSchema)
      .min(1, "Choose at least one game.")
      .max(GAMES.length, "Choose only supported games.")
      .refine((values) => new Set(values).size === values.length, "Choose each game only once."),
    experience: z
      .string()
      .trim()
      .min(50, "Write at least 50 characters.")
      .max(1000, "Use 1000 characters or fewer."),
    motivation: z
      .string()
      .trim()
      .min(50, "Write at least 50 characters.")
      .max(1000, "Use 1000 characters or fewer."),
    agreesToRules: z.boolean().refine((value) => value === true, {
      message: "You must agree to the organiser code of conduct.",
    }),
  })
  .strict();

export const applicationApproveSchema = z
  .object({
    note: z.string().trim().max(300, "Use 300 characters or fewer.").optional(),
  })
  .strict();

export const applicationRejectSchema = z
  .object({
    note: z
      .string()
      .trim()
      .min(10, "Give the applicant at least 10 characters of feedback.")
      .max(300, "Use 300 characters or fewer."),
  })
  .strict();

export type AdminApplicationSubmitInput = z.infer<typeof adminApplicationSubmitSchema>;
export type ApplicationApproveInput = z.infer<typeof applicationApproveSchema>;
export type ApplicationRejectInput = z.infer<typeof applicationRejectSchema>;
