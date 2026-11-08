// GCC — admin-only match result and "Report a problem" input schemas.
//
// Results are entered by the tournament owner or Super Admin. Players never
// submit or confirm scores; they can only report a problem for admin review.
import { z } from "zod";

export const scoreSchema = z.number().int().min(0).max(99);

const firestoreIdSchema = z.string().trim().min(1).max(128);

export const matchResultEntrySchema = z.object({
  tournamentId: firestoreIdSchema,
  matchId: firestoreIdSchema,
  homeGoals: scoreSchema,
  awayGoals: scoreSchema,
});

export const matchResultCorrectionSchema = matchResultEntrySchema.extend({
  reason: z.string().trim().min(5).max(300),
});

export const resultReportCreateSchema = z.object({
  tournamentId: firestoreIdSchema,
  matchId: firestoreIdSchema,
  reason: z.string().trim().min(5).max(500),
});

export const resultReportResolveSchema = z.object({
  tournamentId: firestoreIdSchema,
  reportId: firestoreIdSchema,
  decision: z.enum(["resolved", "dismissed"]),
  adminNote: z.string().trim().min(5).max(1000),
});

export type MatchResultEntryInput = z.infer<typeof matchResultEntrySchema>;
export type MatchResultCorrectionInput = z.infer<typeof matchResultCorrectionSchema>;
export type ResultReportCreateInput = z.infer<typeof resultReportCreateSchema>;
export type ResultReportResolveInput = z.infer<typeof resultReportResolveSchema>;
