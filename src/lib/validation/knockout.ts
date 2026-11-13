// GCC - knockout route input schemas.
//
// A client never supplies ties, seeds or match ids. It chooses a round, an
// optional leg count for that round, a decider winner/method and an optional
// note. The final is always one match.
import { z } from "zod";

export const knockoutRoundSchema = z.enum(["playoff", "r16", "qf", "sf", "final"]);

export const knockoutLegsSchema = z.union([z.literal(1), z.literal(2)]);

export const knockoutDrawSchema = z.strictObject({
  round: knockoutRoundSchema,
  legs: knockoutLegsSchema.optional(),
});

export const knockoutPublishSchema = z.strictObject({
  round: knockoutRoundSchema,
});

export const knockoutResetSchema = z.strictObject({
  round: knockoutRoundSchema,
  reason: z.string().trim().max(500, "That reason is too long.").optional(),
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

export const tournamentCompleteSchema = z.strictObject({
  reason: z.string().trim().max(500, "That reason is too long.").optional(),
});

export type KnockoutDrawInput = z.infer<typeof knockoutDrawSchema>;
export type KnockoutPublishInput = z.infer<typeof knockoutPublishSchema>;
export type KnockoutResetInput = z.infer<typeof knockoutResetSchema>;
export type KnockoutDecideInput = z.infer<typeof knockoutDecideSchema>;
export type TournamentCompleteInput = z.infer<typeof tournamentCompleteSchema>;
