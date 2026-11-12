// GCC - fixture route input schemas (Phase 10).
//
// A client never supplies fixtures, tags, the seed or the algorithm version.
// It only sends the eight informational matchday windows, an optional reset
// reason, or a replacement window for one published matchday.
import { z } from "zod";

const dateValueSchema = z
  .string()
  .trim()
  .min(1, "Choose a date.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "That date is not valid.");

export const fixtureWindowSchema = z.strictObject({
  number: z.number().int().min(1).max(8),
  startsOn: dateValueSchema,
  endsOn: dateValueSchema,
});

export const fixturesGenerateSchema = z.strictObject({});

export const fixturesPublishSchema = z.strictObject({
  windows: z.array(fixtureWindowSchema).length(8).optional(),
});

export const fixturesResetSchema = z.strictObject({
  reason: z.string().trim().max(500, "That reason is too long.").optional(),
});

export const fixtureMatchdayUpdateSchema = z.strictObject({
  startsOn: dateValueSchema,
  endsOn: dateValueSchema,
});

export type FixtureWindowInput = z.infer<typeof fixtureWindowSchema>;
export type FixtureMatchdayUpdateInput = z.infer<typeof fixtureMatchdayUpdateSchema>;
