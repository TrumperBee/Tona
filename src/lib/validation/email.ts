// GCC - email preference payloads.
//
// Preference toggles are owner-only, so the payload never names a uid. The
// unsubscribe endpoint receives only a signed token, never an address.
import { z } from "zod";

export const unsubscribeSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(10, "This unsubscribe link is incomplete.")
      .max(4096, "This unsubscribe link is too long."),
  })
  .strict();

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

export const notificationPreferenceKeys = [
  "important",
  "resultEmails",
  "announcementEmails",
] as const;

export const notificationPreferencesSchema = z
  .object({
    important: z.boolean(),
    resultEmails: z.boolean(),
    announcementEmails: z.boolean(),
  })
  .strict();

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export const changeEmailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Use 254 characters or fewer.")
      .pipe(z.email("Enter a valid email address.")),
  })
  .strict();

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const emailAnnouncementsSchema = z
  .object({
    emailAnnouncements: z.boolean(),
  })
  .strict();

export type EmailAnnouncementsInput = z.infer<typeof emailAnnouncementsSchema>;
