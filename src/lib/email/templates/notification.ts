// GCC - notification email template.
//
// One template serves every typed notification. The kind chooses the subject
// and the small label above the heading; the content is passed in already
// human-readable and is escaped by the layout.
import { SITE_URL } from "@/lib/config/site";

import { NOTIFICATION_REGISTRY, type NotificationKind } from "@/lib/notifications/types";

import { renderEmailLayout, type RenderedEmail } from "./layout";

export interface NotificationEmailData {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly link?: string | null;
  readonly bullets?: readonly string[];
  readonly subject?: string;
  readonly heading?: string;
  readonly paragraphs?: readonly string[];
  readonly buttonLabel?: string;
  readonly unsubscribeUrl?: string | null;
}

const SUBJECTS: Readonly<Record<NotificationKind, string>> = {
  organiser_approved: "Your organiser application was approved",
  organiser_rejected: "Your organiser application was not approved",
  account_suspended: "Your GCC account was suspended",
  account_banned: "Your GCC account was banned",
  account_restored: "Your GCC account was restored",
  tournament_cancelled: "A tournament you entered was cancelled",
  email_changed: "Your GCC email address was changed",
  registration_confirmed: "Your entry is confirmed",
  draw_complete: "The draw is complete",
  fixtures_published: "Your fixtures are published",
  knockout_qualified: "You are in the knockout stage",
  knockout_tie_ready: "Your next knockout tie is ready",
  tournament_completed: "Your tournament is complete",
  field_full: "Your tournament field is full",
  result_report_received: "A result report needs your review",
  admin_new_application: "New organiser application",
  organiser_revoked: "Your organiser role was revoked",
  registration_withdrawn: "Your entry was withdrawn",
  registration_removed: "You were removed from a competition",
  tournament_suspended: "A tournament was suspended",
  tournament_restored: "A tournament was restored",
  tournament_ownership_changed: "Tournament ownership changed",
  result_recorded: "A result was recorded",
  result_report_outcome: "Your result report was reviewed",
  tournament_announcement: "Tournament announcement",
  platform_announcement: "GCC announcement",
};

const BUTTON_LABELS: Readonly<Partial<Record<NotificationKind, string>>> = {
  organiser_approved: "Open your dashboard",
  organiser_rejected: "Open your dashboard",
  account_suspended: "Open GCC",
  account_banned: "Open GCC",
  account_restored: "Sign in again",
  tournament_cancelled: "View the tournament",
  registration_confirmed: "View the tournament",
  draw_complete: "View your pot",
  fixtures_published: "View your fixtures",
  knockout_qualified: "View the bracket",
  knockout_tie_ready: "View your tie",
  tournament_completed: "View the final standings",
  field_full: "View registrations",
  result_report_received: "Review the report",
  admin_new_application: "Review the application",
  organiser_revoked: "Open your dashboard",
  registration_withdrawn: "View the tournament",
  registration_removed: "Open your dashboard",
  tournament_suspended: "Open the organiser console",
  tournament_restored: "Open the organiser console",
  tournament_ownership_changed: "Open the organiser console",
  result_recorded: "View the match",
  result_report_outcome: "View the match",
  tournament_announcement: "Read the announcement",
  platform_announcement: "Read the announcement",
};

/** Turns a stored app path into an absolute URL; leaves absolute URLs alone. */
export function absoluteEmailUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `${SITE_URL.replace(/\/+$/, "")}${link.startsWith("/") ? "" : "/"}${link}`;
}

export function notificationSubject(kind: NotificationKind, title: string): string {
  const base = SUBJECTS[kind] ?? title;
  return base;
}

export function renderNotificationEmail(data: NotificationEmailData): RenderedEmail {
  const registry = NOTIFICATION_REGISTRY[data.kind];
  const paragraphs = data.paragraphs && data.paragraphs.length > 0 ? data.paragraphs : [data.body];
  const url = absoluteEmailUrl(data.link);
  const button =
    url && data.kind !== "account_suspended" && data.kind !== "account_banned"
      ? { label: data.buttonLabel ?? BUTTON_LABELS[data.kind] ?? "Open GCC", url }
      : null;

  return renderEmailLayout({
    preheader: data.body.slice(0, 140),
    heading: data.heading ?? data.title,
    paragraphs,
    bullets: data.bullets,
    button,
    kindLabel: registry.label,
    unsubscribeUrl: registry.category === "critical" ? null : (data.unsubscribeUrl ?? null),
  });
}
