// GCC - the single notification entry point.
//
// Every feature calls `notify()`. It always writes the in-app notification and
// defers email delivery to after the response, where the typed registry,
// recipient preferences, suppression, deliverability and quota decide whether
// anything is actually emailed. There is no second path that sends a
// notification email.
import "server-only";

import { runAfterResponse } from "@/lib/email/after";
import { deliverNotificationEmails, type NotificationEmailContent } from "@/lib/email/deliver";

import { createNotification, createNotifications } from "./index";
import { NOTIFICATION_REGISTRY, type NotificationKind } from "./types";

export interface NotifyInput {
  readonly recipients: readonly string[] | string;
  readonly type: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly link?: string | null;
  readonly email?: NotificationEmailContent;
}

function uniqueRecipients(recipients: readonly string[] | string): readonly string[] {
  const list = typeof recipients === "string" ? [recipients] : recipients;
  return [...new Set(list.filter((uid) => uid.trim().length > 0))];
}

/**
 * Writes one in-app notification per recipient and schedules the matching
 * email. Returns the number of in-app documents written.
 */
export async function notify(input: NotifyInput): Promise<number> {
  const recipients = uniqueRecipients(input.recipients);

  if (recipients.length === 0) {
    return 0;
  }

  const definition = NOTIFICATION_REGISTRY[input.type];

  const written =
    recipients.length === 1
      ? await createNotification(recipients[0], {
          type: definition.legacyType,
          kind: input.type,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
        }).then(() => 1)
      : await createNotifications(recipients, {
          type: definition.legacyType,
          kind: input.type,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
        });

  runAfterResponse(() =>
    deliverNotificationEmails({
      kind: input.type,
      recipients,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      email: input.email,
    }),
  );

  return written;
}

/** Convenience wrapper for one recipient. */
export function notifyOne(uid: string, input: Omit<NotifyInput, "recipients">): Promise<number> {
  return notify({ ...input, recipients: uid });
}
