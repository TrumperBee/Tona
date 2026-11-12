// GCC - admin-only match result and "Report a problem" input schemas.
//
// Results are entered by the tournament owner or Super Admin. Players never
// submit or confirm scores; they can only report a problem for admin review.
// Tournament and match ids come from the route, never from the client body.
import { z } from "zod";

export const scoreSchema = z.number().int().min(0).max(99);

const firestoreIdSchema = z.string().trim().min(1).max(128);

export const matchResultEntrySchema = z.strictObject({
  matchId: firestoreIdSchema,
  homeGoals: scoreSchema,
  awayGoals: scoreSchema,
});

export const matchResultBulkSchema = z.strictObject({
  results: z.array(matchResultEntrySchema).min(1).max(18),
});

export const matchResultCorrectionSchema = z.strictObject({
  matchId: firestoreIdSchema,
  homeGoals: scoreSchema,
  awayGoals: scoreSchema,
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(300, "That reason is too long."),
});

export const matchResultClearSchema = z.strictObject({
  matchId: firestoreIdSchema,
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(300, "That reason is too long."),
});

export const resultReportCreateSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters.")
    .max(500, "That description is too long."),
});

export const resultReportResolveSchema = z.strictObject({
  decision: z.enum(["resolved", "dismissed"]),
  adminNote: z
    .string()
    .trim()
    .min(5, "Add a note of at least 5 characters.")
    .max(300, "That note is too long."),
});

export type MatchResultEntryInput = z.infer<typeof matchResultEntrySchema>;
export type MatchResultBulkInput = z.infer<typeof matchResultBulkSchema>;
export type MatchResultCorrectionInput = z.infer<typeof matchResultCorrectionSchema>;
export type MatchResultClearInput = z.infer<typeof matchResultClearSchema>;
export type ResultReportCreateInput = z.infer<typeof resultReportCreateSchema>;
export type ResultReportResolveInput = z.infer<typeof resultReportResolveSchema>;
