// GCC - server-side notification preference reads and writes.
//
// Preferences live on the private user document. Only server code writes them;
// the owner reads them through their own dashboard page or the settings API.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { DEFAULT_NOTIFICATION_PREFS, normaliseNotificationPrefs } from "@/lib/notifications/policy";
import type { NotificationPrefs, UserDocument } from "@/types/domain";

export interface NotificationSettings {
  readonly prefs: NotificationPrefs;
  readonly email: string;
  readonly emailDeliverable: boolean;
}

export async function readNotificationPrefs(uid: string): Promise<NotificationPrefs> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.user(uid)).get();

  if (!snapshot.exists) {
    return DEFAULT_NOTIFICATION_PREFS;
  }

  const data = snapshot.data() as Partial<UserDocument>;
  return normaliseNotificationPrefs(data.notificationPrefs);
}

export async function readNotificationSettings(uid: string): Promise<NotificationSettings | null> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.user(uid)).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Partial<UserDocument>;

  return {
    prefs: normaliseNotificationPrefs(data.notificationPrefs),
    email: typeof data.email === "string" ? data.email : "",
    emailDeliverable: data.emailDeliverable !== false,
  };
}

/** Writes the complete preference document. */
export async function writeNotificationPrefs(
  uid: string,
  prefs: NotificationPrefs,
): Promise<NotificationPrefs> {
  await getFirebaseAdminFirestore()
    .doc(paths.user(uid))
    .update({
      notificationPrefs: {
        important: prefs.important,
        resultEmails: prefs.resultEmails,
        announcementEmails: prefs.announcementEmails,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

  return prefs;
}

export async function setEmailDeliverable(uid: string, deliverable: boolean): Promise<void> {
  await getFirebaseAdminFirestore()
    .doc(paths.user(uid))
    .set(
      { emailDeliverable: deliverable, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
}
