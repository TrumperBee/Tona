// GCC — pot draw input schemas (Phase 9).
//
// A client never supplies the shuffle seed, pot contents, counts or the
// confirmation state. It only names players, target pots, lock toggles and the
// reasons required for destructive actions; the server derives everything else.
import { z } from "zod";

/** Firestore document ids are not slashes; 128 matches the auth uid bound. */
export const drawUidSchema = z
  .string()
  .trim()
  .min(1, "Choose a player.")
  .max(128, "That player id is too long.")
  .refine((value) => !value.includes("/"), "That player id is invalid.");

export const drawPotNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/** A uid-to-pot pin map. Values are numeric 1-4, matching the pure engine. */
export const drawLockMapSchema = z.record(drawUidSchema, drawPotNumberSchema);

export const drawShuffleSchema = z.strictObject({
  locked: drawLockMapSchema.optional(),
});

export const drawAssignSchema = z.strictObject({
  uid: drawUidSchema,
  pot: drawPotNumberSchema.nullable(),
});

export const drawLockSchema = z.strictObject({
  uid: drawUidSchema,
  locked: z.boolean(),
});

export const drawUnconfirmSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(300, "Keep the reason under 300 characters."),
});

export const drawReplaceSchema = z.strictObject({
  outUid: drawUidSchema,
  inUid: drawUidSchema,
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(300, "Keep the reason under 300 characters."),
});

export type DrawShuffleInput = z.infer<typeof drawShuffleSchema>;
export type DrawAssignInput = z.infer<typeof drawAssignSchema>;
export type DrawLockInput = z.infer<typeof drawLockSchema>;
export type DrawUnconfirmInput = z.infer<typeof drawUnconfirmSchema>;
export type DrawReplaceInput = z.infer<typeof drawReplaceSchema>;
