// GCC - platform announcement validation.
//
// Announcements are plain text. `expiresAt` arrives as an ISO timestamp or
// null; the server converts it to a Firestore Timestamp.
import { z } from "zod";

import { ANNOUNCEMENT_SEVERITIES } from "@/types/domain";

export const ANNOUNCEMENT_TITLE_MAX = 100;
export const ANNOUNCEMENT_BODY_MAX = 2000;

const expiresAtSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

export const announcementContentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(ANNOUNCEMENT_TITLE_MAX, `Use ${ANNOUNCEMENT_TITLE_MAX} characters or fewer.`),
    body: z
      .string()
      .trim()
      .min(5, "Write at least 5 characters.")
      .max(ANNOUNCEMENT_BODY_MAX, `Use ${ANNOUNCEMENT_BODY_MAX} characters or fewer.`),
    severity: z.enum(ANNOUNCEMENT_SEVERITIES),
    pinned: z.boolean(),
    expiresAt: expiresAtSchema,
  })
  .strict();

export const announcementCreateSchema = announcementContentSchema
  .extend({
    publishNow: z.boolean(),
  })
  .strict();

export type AnnouncementContentInput = z.infer<typeof announcementContentSchema>;
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
