// GCC — match, result and dispute input schemas.
// Scores submitted by participants are never trusted as final: an authorised
// admin confirms them before they affect standings.
import { z } from "zod";

export const scoreSchema = z.number().int().min(0).max(99);

const firestoreIdSchema = z.string().trim().min(1).max(128);

export const matchResultSubmissionSchema = z.object({
  matchId: firestoreIdSchema,
  homeGoals: scoreSchema,
  awayGoals: scoreSchema,
});

export const matchResultReviewSchema = z.object({
  matchId: firestoreIdSchema,
  decision: z.enum(["confirm", "reject"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export const disputeCreateSchema = z.object({
  matchId: firestoreIdSchema,
  reason: z.string().trim().min(10).max(1000),
  evidenceNotes: z.string().trim().max(5000).optional(),
});

export const disputeResolveSchema = z.object({
  disputeId: firestoreIdSchema,
  decision: z.enum(["resolved", "rejected"]),
  resolution: z.string().trim().min(10).max(2000),
});

export type MatchResultSubmissionInput = z.infer<typeof matchResultSubmissionSchema>;
export type MatchResultReviewInput = z.infer<typeof matchResultReviewSchema>;
export type DisputeCreateInput = z.infer<typeof disputeCreateSchema>;
export type DisputeResolveInput = z.infer<typeof disputeResolveSchema>;
