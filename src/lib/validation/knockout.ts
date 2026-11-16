// GCC - knockout route input schemas.
//
// A client never supplies ties, seeds, participants or match ids. It chooses a
// single leg count for the whole bracket, a decider winner/method and an
// optional note, or a reason for resetting an unplayed bracket.
import { z } from "zod";

export const knockoutRoundSchema = z.enum(["playoff", "r16", "qf", "sf", "final"]);

export const knockoutLegsSchema = z.union([z.literal(1), z.literal(2)]);

export const knockoutGenerateSchema = z.strictObject({
  /** Applied to play-offs, R16, QF and SF; the final is always one match. */
  legs: knockoutLegsSchema.default(2),
});

export const knockoutResetStageSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(3, "Give a short reason for resetting the bracket.")
    .max(500, "That reason is too long."),
});

const penaltyScoreSchema = z.number().int().min(0).max(99);

export const knockoutDecideSchema = z.strictObject({
  winnerUid: z.string().trim().min(1).max(128),
  method: z.enum(["extra_time", "penalties"]),
  note: z.string().trim().max(300, "That note is too long.").optional(),
  penalties: z
    .strictObject({
      higher: penaltyScoreSchema,
      lower: penaltyScoreSchema,
    })
    .optional(),
});

export type KnockoutGenerateInput = z.infer<typeof knockoutGenerateSchema>;
export type KnockoutResetStageInput = z.infer<typeof knockoutResetStageSchema>;
export type KnockoutDecideInput = z.infer<typeof knockoutDecideSchema>;
