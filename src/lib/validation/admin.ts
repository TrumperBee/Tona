// GCC — privileged account-administration schemas.
// These payloads are accepted only by server code after requireSuperAdmin().
import { z } from "zod";

import { ACCOUNT_STATUSES, USER_ROLES } from "@/types/domain";

const firestoreIdSchema = z.string().trim().min(1).max(128);

export const roleAssignmentSchema = z.object({
  targetUid: firestoreIdSchema,
  role: z.enum(USER_ROLES),
  reason: z.string().trim().max(500).optional(),
});

export const accountStatusUpdateSchema = z.object({
  targetUid: firestoreIdSchema,
  status: z.enum(ACCOUNT_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;
export type AccountStatusUpdateInput = z.infer<typeof accountStatusUpdateSchema>;
