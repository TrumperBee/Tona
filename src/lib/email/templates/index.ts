// GCC - every email template rendered with representative sample data.
//
// Used only by the development preview route. It never sends anything and the
// route returns 404 in production.
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/notifications/types";

import { renderEmailLayout } from "./layout";
import {
  notificationSubject,
  renderNotificationEmail,
  type NotificationEmailData,
} from "./notification";
import { renderEmailChangedEmail, renderTestEmail } from "./security";
import { renderWelcomeEmail } from "./welcome";

export interface PreviewTemplate {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const SAMPLE_LINK = "/dashboard/notifications";
const SAMPLE_UNSUBSCRIBE = "https://example.com/unsubscribe?t=sample-token";

const SAMPLE_BY_KIND: Readonly<
  Partial<Record<NotificationKind, Pick<NotificationEmailData, "body" | "bullets" | "heading">>>
> = {
  draw_complete: {
    heading: "The draw is complete",
    body: "You are in Pot 2 for GCC Champions Cup.",
    bullets: ["Pot 2", "League phase starts on 1 December", "Your fixtures arrive next"],
  },
  fixtures_published: {
    heading: "Your fixtures are published",
    body: "Your eight league-phase matches are ready.",
    bullets: [
      "Matchday 1 vs @RivalOne",
      "Matchday 2 vs @RivalTwo",
      "Matchday 3 vs @RivalThree",
      "Matchday 4 vs @RivalFour",
      "Matchday 5 vs @RivalFive",
      "Matchday 6 vs @RivalSix",
      "Matchday 7 vs @RivalSeven",
      "Matchday 8 vs @RivalEight",
    ],
  },
  tournament_completed: {
    heading: "GCC Champions Cup is complete",
    body: "@WinnerTag is the champion. The final result and the frozen league table are on the tournament page.",
  },
};

function sampleData(kind: NotificationKind): NotificationEmailData {
  const sample = SAMPLE_BY_KIND[kind];
  const title = sample?.heading ?? "Sample notification";
  const body = sample?.body ?? "This is how a notification email looks with real content.";

  return {
    kind,
    title,
    heading: sample?.heading,
    body,
    bullets: sample?.bullets,
    link: SAMPLE_LINK,
    unsubscribeUrl: SAMPLE_UNSUBSCRIBE,
  };
}

/** Returns one entry for every template, in a stable order. */
export function renderAllEmailTemplates(): readonly PreviewTemplate[] {
  const templates: PreviewTemplate[] = NOTIFICATION_KINDS.map((kind) => {
    const data = sampleData(kind);
    const rendered = renderNotificationEmail(data);

    return {
      id: kind,
      name: kind,
      subject: notificationSubject(kind, data.title),
      html: rendered.html,
      text: rendered.text,
    };
  });

  const welcome = renderWelcomeEmail({ gamerTag: "SamplePlayer" });
  templates.push({
    id: "welcome",
    name: "welcome",
    subject: "Welcome to GCC",
    html: welcome.html,
    text: welcome.text,
  });

  const changed = renderEmailChangedEmail({
    gamerTag: "SamplePlayer",
    newEmail: "new@example.com",
  });
  templates.push({
    id: "email-changed",
    name: "email-changed",
    subject: "Your GCC email address was changed",
    html: changed.html,
    text: changed.text,
  });

  const test = renderTestEmail({ adminEmail: "owner@example.com" });
  templates.push({
    id: "test",
    name: "test",
    subject: "Test email",
    html: test.html,
    text: test.text,
  });

  const empty = renderEmailLayout({
    preheader: "Layout",
    heading: "Plain layout",
    paragraphs: ["A minimal message with no button."],
  });
  templates.push({
    id: "layout",
    name: "layout",
    subject: "Plain layout",
    html: empty.html,
    text: empty.text,
  });

  return templates;
}
