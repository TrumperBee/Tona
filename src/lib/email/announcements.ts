// GCC - platform announcement broadcast.
//
// Publishing an announcement writes one in-app notification and one email for
// every user who opted in to announcement email, but only while the Super Admin
// keeps the platform email switch on. Both the monthly reference and the
// remaining normal daily capacity are checked BEFORE any document is written so
// a large announcement cannot silently drain the quota or be half-sent.
import "server-only";

import { runAfterResponse } from "@/lib/email/after";
import { dailyNormalCap, readEmailUsage } from "@/lib/email/quota";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { getPlatformSettings } from "@/lib/platform/settings";
import { notify } from "@/lib/notifications/service";

/** Upper bound for one broadcast; matches a single Firestore page of users. */
export const ANNOUNCEMENT_RECIPIENT_LIMIT = 900;

export interface AnnouncementBroadcastInput {
  readonly title: string;
  readonly body: string;
  readonly link: string;
}

export interface AnnouncementBroadcastResult {
  readonly status:
    | "scheduled"
    | "disabled"
    | "monthly_quota_exhausted"
    | "daily_quota_exhausted"
    | "no_recipients"
    | "failed";
  readonly recipients: number;
}

/** Addresses that opted in, are active and can receive email. */
export async function optedInAnnouncementRecipients(): Promise<readonly string[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.users())
    .where("notificationPrefs.announcementEmails", "==", true)
    .limit(ANNOUNCEMENT_RECIPIENT_LIMIT)
    .get();

  return snapshot.docs
    .filter((document) => document.data().status === "active")
    .filter((document) => document.data().emailDeliverable !== false)
    .map((document) => document.id);
}

/**
 * Sends one platform announcement, or does nothing when the switch is off or
 * the monthly reference is already reached. Never throws into the publish flow.
 */
export async function broadcastPlatformAnnouncement(
  input: AnnouncementBroadcastInput,
): Promise<AnnouncementBroadcastResult> {
  try {
    const settings = await getPlatformSettings();

    if (!settings.emailAnnouncements) {
      return { status: "disabled", recipients: 0 };
    }

    const usage = await readEmailUsage();

    if (usage.monthly.sent >= usage.monthlyLimit) {
      return { status: "monthly_quota_exhausted", recipients: 0 };
    }

    const recipients = await optedInAnnouncementRecipients();

    if (recipients.length === 0) {
      return { status: "no_recipients", recipients: 0 };
    }

    const remainingNormal = Math.max(0, dailyNormalCap(usage.dailyLimit) - usage.daily.sent);

    if (recipients.length > remainingNormal) {
      return { status: "daily_quota_exhausted", recipients: recipients.length };
    }

    runAfterResponse(async () => {
      await notify({
        recipients,
        type: "platform_announcement",
        title: input.title,
        body: input.body,
        link: input.link,
        email: {
          heading: input.title,
          paragraphs: [input.body],
          buttonLabel: "Read the announcement",
        },
      });
    });

    return { status: "scheduled", recipients: recipients.length };
  } catch {
    return { status: "failed", recipients: 0 };
  }
}
