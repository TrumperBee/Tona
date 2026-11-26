// GCC - pure email preference resolution.
//
// Kept free of Firebase and `server-only` so the rules can be unit-tested
// without an emulator. The service and the settings page both use it.
import type { NotificationPrefs } from "@/types/domain";

import { NOTIFICATION_REGISTRY, notificationPreferenceKey, type NotificationKind } from "./types";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  important: true,
  resultEmails: false,
  announcementEmails: false,
};

/** Fills missing or malformed stored values with the documented defaults. */
export function normaliseNotificationPrefs(value: unknown): NotificationPrefs {
  const stored = typeof value === "object" && value !== null ? value : {};
  const read = (key: keyof NotificationPrefs, fallback: boolean): boolean => {
    const candidate = (stored as Record<string, unknown>)[key];
    return typeof candidate === "boolean" ? candidate : fallback;
  };

  return {
    important: read("important", DEFAULT_NOTIFICATION_PREFS.important),
    resultEmails: read("resultEmails", DEFAULT_NOTIFICATION_PREFS.resultEmails),
    announcementEmails: read("announcementEmails", DEFAULT_NOTIFICATION_PREFS.announcementEmails),
  };
}

export interface EmailDecision {
  readonly emailAllowed: boolean;
  readonly category: (typeof NOTIFICATION_REGISTRY)[NotificationKind]["category"];
  readonly reason: "critical" | "enabled" | "opted_out";
}

/**
 * Resolves whether a kind may email a recipient. Critical kinds ignore every
 * preference; important kinds follow `important`; optional kinds follow the
 * stream flag. Suppression, quota and a missing address are applied later.
 */
export function resolveEmailDecision(
  kind: NotificationKind,
  prefs: NotificationPrefs | null | undefined,
): EmailDecision {
  const definition = NOTIFICATION_REGISTRY[kind];
  const resolved = normaliseNotificationPrefs(prefs ?? {});

  if (definition.category === "critical") {
    return { emailAllowed: true, category: definition.category, reason: "critical" };
  }

  const key = notificationPreferenceKey(kind);

  if (key === null) {
    return { emailAllowed: true, category: definition.category, reason: "enabled" };
  }

  return resolved[key]
    ? { emailAllowed: true, category: definition.category, reason: "enabled" }
    : { emailAllowed: false, category: definition.category, reason: "opted_out" };
}

/** Applies one unsubscribe stream to a preference document. */
export function applyUnsubscribe(
  prefs: NotificationPrefs,
  category: "important" | "result" | "announcement",
): NotificationPrefs {
  if (category === "important") return { ...prefs, important: false };
  if (category === "result") return { ...prefs, resultEmails: false };
  return { ...prefs, announcementEmails: false };
}
