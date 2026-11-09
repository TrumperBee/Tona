// GCC - Super Admin action validation.
import { z } from "zod";

import { ACCOUNT_STATUSES } from "@/types/domain";

export const reasonSchema = z
  .string()
  .trim()
  .min(5, "Give a reason of at least 5 characters.")
  .max(300, "Use 300 characters or fewer.");

export const accountStatusChangeSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
    reason: reasonSchema,
  })
  .strict();

export const revokeOrganiserSchema = z
  .object({
    reason: reasonSchema,
  })
  .strict();

export type AccountStatusChangeInput = z.infer<typeof accountStatusChangeSchema>;
export type RevokeOrganiserInput = z.infer<typeof revokeOrganiserSchema>;
