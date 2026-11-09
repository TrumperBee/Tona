// GCC - platform settings validation.
//
// Settings are edited only by the Super Admin. The reason is required when
// maintenance mode is switched on so the audit entry explains the outage.
import { z } from "zod";

export const MAINTENANCE_MESSAGE_MAX = 300;

export const platformSettingsSchema = z
  .object({
    maintenanceMode: z.boolean(),
    maintenanceMessage: z
      .string()
      .trim()
      .max(MAINTENANCE_MESSAGE_MAX, `Use ${MAINTENANCE_MESSAGE_MAX} characters or fewer.`)
      .default(""),
    registrationsOpen: z.boolean(),
    maxActiveTournamentsPerOrganiser: z
      .number()
      .int("Use a whole number.")
      .min(1, "Allow at least 1 active tournament.")
      .max(20, "Allow at most 20 active tournaments."),
    applicationCooldownDays: z
      .number()
      .int("Use a whole number.")
      .min(0, "The cooldown cannot be negative.")
      .max(90, "The cooldown cannot exceed 90 days."),
    reason: z
      .string()
      .trim()
      .min(5, "Give a reason of at least 5 characters.")
      .max(300, "Use 300 characters or fewer.")
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.maintenanceMode && value.maintenanceMessage.length < 5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maintenanceMessage"],
        message: "Write a message of at least 5 characters for the maintenance banner.",
      });
    }
  });

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
