// GCC - notification read-state payloads.
//
// The owner is always the authenticated session UID; there is no `uid` field in
// the payload. A caller may name up to 50 of their own notification ids or ask
// to mark every unread notification as read, never both.
import { z } from "zod";

export const MARK_NOTIFICATIONS_READ_MAX = 50;

const idsSchema = z
  .array(z.string().trim().min(1).max(128))
  .min(1, "Choose at least one notification.")
  .max(MARK_NOTIFICATIONS_READ_MAX, `Choose at most ${MARK_NOTIFICATIONS_READ_MAX} notifications.`);

export const markNotificationsReadSchema = z.union([
  z.object({ ids: idsSchema }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
