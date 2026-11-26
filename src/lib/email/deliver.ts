// GCC - the only place that decides and performs email delivery.
//
// `notify()` writes the in-app record synchronously and hands the email work to
// this module through `after()`. Here we resolve preferences, suppression,
// deliverability and quota, render one message per recipient, then call Resend.
// Nothing in this module throws into the triggering action.
import "server-only";

import { SITE_URL } from "@/lib/config/site";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { normaliseNotificationPrefs, resolveEmailDecision } from "@/lib/notifications/policy";
import {
  NOTIFICATION_REGISTRY,
  notificationUnsubscribeCategory,
  type NotificationKind,
} from "@/lib/notifications/types";
import type { UserDocument } from "@/types/domain";

import { sendEmail, sendEmailBatch, type EmailMessage, type EmailSendOutcome } from "./client";
import { getEmailConfig, hasUnsubscribeSecret } from "./config";
import { writeEmailFailure } from "./failures";
import { releaseFailedQuota, reserveEmailQuota } from "./quota";
import { isSuppressed, suppressionId } from "./suppression";
import type { RenderedEmail } from "./templates/layout";
import { notificationSubject, renderNotificationEmail } from "./templates/notification";
import { buildUnsubscribeUrl } from "./tokens";

export interface NotificationEmailContent {
  readonly subject?: string;
  readonly heading?: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
  readonly buttonLabel?: string;
}

export interface NotificationEmailInput {
  readonly kind: NotificationKind;
  readonly recipients: readonly string[];
  readonly title: string;
  readonly body: string;
  readonly link?: string | null;
  readonly email?: NotificationEmailContent;
}

export interface DeliverySummary {
  readonly recipients: number;
  readonly eligible: number;
  readonly sent: number;
  readonly skipped: number;
  readonly failed: number;
}

interface UserEmailState {
  readonly uid: string;
  readonly email: string;
  readonly deliverable: boolean;
  readonly prefs: ReturnType<typeof normaliseNotificationPrefs>;
}

async function loadUserEmailStates(uids: readonly string[]): Promise<readonly UserEmailState[]> {
  const firestore = getFirebaseAdminFirestore();
  const unique = [...new Set(uids.filter((uid) => uid.trim().length > 0))];
  const states: UserEmailState[] = [];

  for (let offset = 0; offset < unique.length; offset += 500) {
    const chunk = unique.slice(offset, offset + 500);
    const snapshots = await firestore.getAll(...chunk.map((uid) => firestore.doc(paths.user(uid))));

    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const data = snapshot.data() as Partial<UserDocument>;
      const email = typeof data.email === "string" ? data.email.trim() : "";

      states.push({
        uid: snapshot.id,
        email,
        deliverable: data.emailDeliverable !== false,
        prefs: normaliseNotificationPrefs(data.notificationPrefs),
      });
    }
  }

  return states;
}

async function suppressedIds(emails: readonly string[]): Promise<ReadonlySet<string>> {
  const firestore = getFirebaseAdminFirestore();
  const ids = [...new Set(emails.filter((email) => email.trim()).map(suppressionId))];
  const suppressed = new Set<string>();

  for (let offset = 0; offset < ids.length; offset += 500) {
    const chunk = ids.slice(offset, offset + 500);
    const snapshots = await firestore.getAll(
      ...chunk.map((id) => firestore.doc(paths.emailSuppression(id))),
    );
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) suppressed.add(snapshot.id);
    });
  }

  return suppressed;
}

/**
 * Delivers one notification kind to many recipients. Returns counts for tests
 * and diagnostics; callers ignore them.
 */
export async function deliverNotificationEmails(
  input: NotificationEmailInput,
): Promise<DeliverySummary> {
  const registry = NOTIFICATION_REGISTRY[input.kind];
  const critical = registry.category === "critical";

  try {
    const config = getEmailConfig();
    const canUnsubscribe = critical || hasUnsubscribeSecret(config);

    if (!canUnsubscribe) {
      return {
        recipients: input.recipients.length,
        eligible: 0,
        sent: 0,
        skipped: input.recipients.length,
        failed: 0,
      };
    }

    const states = await loadUserEmailStates(input.recipients);
    const candidates = states.filter((state) => {
      if (!state.email) return false;
      if (!state.deliverable) return false;
      return resolveEmailDecision(input.kind, state.prefs).emailAllowed;
    });

    if (candidates.length === 0) {
      return {
        recipients: states.length,
        eligible: 0,
        sent: 0,
        skipped: states.length,
        failed: 0,
      };
    }

    const suppressed = await suppressedIds(candidates.map((state) => state.email));
    const eligible = candidates.filter((state) => !suppressed.has(suppressionId(state.email)));

    if (eligible.length === 0) {
      return {
        recipients: states.length,
        eligible: 0,
        sent: 0,
        skipped: states.length,
        failed: 0,
      };
    }

    const reservation = await reserveEmailQuota({ count: eligible.length, critical });
    const allowed = eligible.slice(0, reservation.allowed);

    if (allowed.length === 0) {
      return {
        recipients: states.length,
        eligible: eligible.length,
        sent: 0,
        skipped: states.length,
        failed: 0,
      };
    }

    const messages: EmailMessage[] = [];

    for (const state of allowed) {
      const category = notificationUnsubscribeCategory(input.kind);
      const unsubscribeUrl =
        category && config.unsubscribeSecret
          ? buildUnsubscribeUrl(config.unsubscribeSecret, SITE_URL, {
              uid: state.uid,
              category,
            })
          : null;

      const rendered = renderNotificationEmail({
        kind: input.kind,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        bullets: input.email?.bullets,
        subject: input.email?.subject,
        heading: input.email?.heading,
        paragraphs: input.email?.paragraphs,
        buttonLabel: input.email?.buttonLabel,
        unsubscribeUrl,
      });

      messages.push({
        to: state.email,
        subject: input.email?.subject ?? notificationSubject(input.kind, input.title),
        html: rendered.html,
        text: rendered.text,
        headers:
          category && unsubscribeUrl
            ? {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : undefined,
        kind: input.kind,
      });
    }

    const outcomes = await sendEmailBatch(messages);
    return await finalise(input.kind, states.length, eligible.length, outcomes);
  } catch {
    // An unexpected failure must not surface into the action that triggered it.
    return {
      recipients: input.recipients.length,
      eligible: 0,
      sent: 0,
      skipped: input.recipients.length,
      failed: 0,
    };
  }
}

async function finalise(
  kind: string,
  recipients: number,
  eligible: number,
  outcomes: readonly EmailSendOutcome[],
): Promise<DeliverySummary> {
  const failures = outcomes.filter((outcome) => !outcome.ok);
  const sent = outcomes.length - failures.length;

  if (failures.length > 0) {
    await releaseFailedQuota(failures.length);
    await Promise.all(
      failures.slice(0, 20).map((failure) =>
        writeEmailFailure({
          kind,
          reason: failure.ok ? "unknown" : failure.reason,
          status: failure.ok ? null : failure.status,
        }),
      ),
    );
  }

  return {
    recipients,
    eligible,
    sent,
    skipped: Math.max(0, recipients - sent),
    failed: failures.length,
  };
}

export interface TransactionalEmailInput {
  readonly to: string;
  readonly kind: string;
  readonly subject: string;
  readonly rendered: RenderedEmail;
  readonly critical: boolean;
  readonly skipSuppression?: boolean;
}

/** Sends a non-notification email (welcome, change notice, test). */
export async function deliverTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<EmailSendOutcome> {
  try {
    if (!input.skipSuppression && (await isSuppressed(input.to))) {
      return { ok: false, reason: "suppressed", status: null };
    }

    const reservation = await reserveEmailQuota({ count: 1, critical: input.critical });

    if (reservation.allowed === 0) {
      return { ok: false, reason: "quota_exhausted", status: null };
    }

    const outcome = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.rendered.html,
      text: input.rendered.text,
      kind: input.kind,
    });

    if (!outcome.ok) {
      await releaseFailedQuota(1);
      await writeEmailFailure({
        kind: input.kind,
        reason: outcome.reason,
        status: outcome.status,
      });
    }

    return outcome;
  } catch {
    return { ok: false, reason: "unexpected_error", status: null };
  }
}
