// GCC - notification view types and the typed email-policy registry.
//
// Every notification that can be emailed is declared here exactly once. The
// service reads this registry to decide whether an email is allowed; the UI
// reads the same names to pick an icon. This module is client-safe.
import type { NotificationType } from "@/types/domain";

export interface NotificationRow {
  readonly id: string;
  readonly type: NotificationType;
  readonly kind: string | null;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: Date | null;
}

export interface NotificationListResult {
  readonly rows: readonly NotificationRow[];
  readonly total: number;
  readonly unread: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

export interface NotificationBellItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly kind: string | null;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: Date | null;
}

export interface NotificationBellData {
  readonly unreadCount: number;
  readonly items: readonly NotificationBellItem[];
}

export const NOTIFICATION_CATEGORIES = ["critical", "important", "optional"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * CRITICAL: always emailed, cannot be disabled.
 * IMPORTANT: emailed by default, controlled by `notificationPrefs.important`.
 * OPTIONAL: in-app only by default, opted into per stream.
 */
export const NOTIFICATION_KINDS = [
  // Critical
  "organiser_approved",
  "organiser_rejected",
  "account_suspended",
  "account_banned",
  "account_restored",
  "tournament_cancelled",
  "email_changed",
  // Important
  "registration_confirmed",
  "draw_complete",
  "fixtures_published",
  "knockout_qualified",
  "knockout_tie_ready",
  "tournament_completed",
  "field_full",
  "result_report_received",
  "admin_new_application",
  "organiser_revoked",
  "registration_withdrawn",
  "registration_removed",
  "tournament_suspended",
  "tournament_restored",
  "tournament_ownership_changed",
  // Optional
  "result_recorded",
  "result_report_outcome",
  "tournament_announcement",
  "platform_announcement",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationKindDefinition {
  readonly category: NotificationCategory;
  /** Whether email is sent before the recipient changes a preference. */
  readonly defaultEmail: boolean;
  /** Whether a bulk send can use one request for many recipients. */
  readonly batchable: boolean;
  /** Stored legacy type so older UI code and indexes keep working. */
  readonly legacyType: NotificationType;
  /** Human label used in settings and the email preview. */
  readonly label: string;
}

export const NOTIFICATION_REGISTRY: Readonly<Record<NotificationKind, NotificationKindDefinition>> =
  {
    organiser_approved: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "application",
      label: "Organiser application approved",
    },
    organiser_rejected: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "application",
      label: "Organiser application rejected",
    },
    account_suspended: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "system",
      label: "Account suspended",
    },
    account_banned: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "system",
      label: "Account banned",
    },
    account_restored: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "system",
      label: "Account restored",
    },
    tournament_cancelled: {
      category: "critical",
      defaultEmail: true,
      batchable: true,
      legacyType: "tournament",
      label: "Tournament cancelled",
    },
    email_changed: {
      category: "critical",
      defaultEmail: true,
      batchable: false,
      legacyType: "system",
      label: "Email address changed",
    },
    registration_confirmed: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Registration confirmed",
    },
    draw_complete: {
      category: "important",
      defaultEmail: true,
      batchable: true,
      legacyType: "tournament",
      label: "Draw complete",
    },
    fixtures_published: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "fixture",
      label: "Fixtures published",
    },
    knockout_qualified: {
      category: "important",
      defaultEmail: true,
      batchable: true,
      legacyType: "tournament",
      label: "Knockout qualification",
    },
    knockout_tie_ready: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "fixture",
      label: "Next knockout tie ready",
    },
    tournament_completed: {
      category: "important",
      defaultEmail: true,
      batchable: true,
      legacyType: "tournament",
      label: "Tournament completed",
    },
    field_full: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Field full",
    },
    result_report_received: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "result_report",
      label: "Result report received",
    },
    admin_new_application: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "application",
      label: "New organiser application",
    },
    organiser_revoked: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "application",
      label: "Organiser role revoked",
    },
    registration_withdrawn: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Registration withdrawn",
    },
    registration_removed: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Removed from a competition",
    },
    tournament_suspended: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Tournament suspended",
    },
    tournament_restored: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Tournament restored",
    },
    tournament_ownership_changed: {
      category: "important",
      defaultEmail: true,
      batchable: false,
      legacyType: "tournament",
      label: "Tournament ownership changed",
    },
    result_recorded: {
      category: "optional",
      defaultEmail: false,
      batchable: false,
      legacyType: "result",
      label: "Result recorded",
    },
    result_report_outcome: {
      category: "optional",
      defaultEmail: false,
      batchable: false,
      legacyType: "result_report",
      label: "Result report reviewed",
    },
    tournament_announcement: {
      category: "optional",
      defaultEmail: false,
      batchable: true,
      legacyType: "announcement",
      label: "Tournament announcements",
    },
    platform_announcement: {
      category: "optional",
      defaultEmail: false,
      batchable: true,
      legacyType: "announcement",
      label: "Platform announcements",
    },
  };

/** The preference flag that controls a kind, or null for critical mail. */
export function notificationPreferenceKey(
  kind: NotificationKind,
): "important" | "resultEmails" | "announcementEmails" | null {
  const definition = NOTIFICATION_REGISTRY[kind];

  if (definition.category === "critical") return null;
  if (definition.category === "important") return "important";
  if (kind === "result_recorded" || kind === "result_report_outcome") return "resultEmails";
  return "announcementEmails";
}

/** Unsubscribe stream name embedded in signed links, or null for critical. */
export function notificationUnsubscribeCategory(
  kind: NotificationKind,
): "important" | "result" | "announcement" | null {
  const key = notificationPreferenceKey(kind);

  if (key === "important") return "important";
  if (key === "resultEmails") return "result";
  if (key === "announcementEmails") return "announcement";
  return null;
}

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}
