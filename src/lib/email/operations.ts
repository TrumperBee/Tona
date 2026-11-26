// GCC - Super Admin email operations.
//
// Reads the daily/monthly counters, the suppression count and the most recent
// send failures. Everything here is aggregate: an address is never returned.
import "server-only";

import { getEmailConfig, hasUnsubscribeSecret, isEmailConfigured } from "@/lib/email/config";
import { optedInAnnouncementRecipients } from "@/lib/email/announcements";
import { writeEmailFailure } from "@/lib/email/failures";
import { listRecentEmailFailures, type EmailFailureRow } from "@/lib/email/failures";
import {
  readEmailUsage,
  releaseFailedQuota,
  reserveEmailQuota,
  type EmailUsageSnapshot,
} from "@/lib/email/quota";
import { countSuppressions } from "@/lib/email/suppression";
import { sendEmail } from "@/lib/email/client";
import { renderTestEmail } from "@/lib/email/templates/security";

export interface EmailOperationsOverview {
  readonly apiConfigured: boolean;
  readonly fromConfigured: boolean;
  readonly webhookConfigured: boolean;
  readonly unsubscribeConfigured: boolean;
  readonly usage: EmailUsageSnapshot;
  readonly suppressions: number;
  readonly failures: readonly EmailFailureRow[];
  /** How many users an announcement would email right now (capped at 900). */
  readonly announcementRecipients: number;
}

export async function getEmailOperationsOverview(): Promise<EmailOperationsOverview> {
  const config = getEmailConfig();
  const [usage, suppressions, failures, announcementRecipients] = await Promise.all([
    readEmailUsage(),
    countSuppressions(),
    listRecentEmailFailures(20),
    optedInAnnouncementRecipients().then((recipients) => recipients.length),
  ]);

  return {
    apiConfigured: isEmailConfigured(config),
    fromConfigured: Boolean(config.from),
    webhookConfigured: Boolean(config.webhookSecret),
    unsubscribeConfigured: hasUnsubscribeSecret(config),
    usage,
    suppressions,
    failures,
    announcementRecipients,
  };
}

export type TestEmailOutcome =
  | { readonly ok: true; readonly simulated: boolean }
  | { readonly ok: false; readonly reason: string };

/** Sends one test message to the Super Admin's own address. */
export async function sendTestEmail(adminEmail: string): Promise<TestEmailOutcome> {
  const reservation = await reserveEmailQuota({ count: 1, critical: true });

  if (reservation.allowed === 0) {
    return { ok: false, reason: "The daily email quota is exhausted." };
  }

  const rendered = renderTestEmail({ adminEmail });
  const outcome = await sendEmail({
    to: adminEmail,
    subject: "GCC test email",
    html: rendered.html,
    text: rendered.text,
    kind: "super_admin_test",
  });

  if (!outcome.ok) {
    await releaseFailedQuota(1);
    await writeEmailFailure({
      kind: "super_admin_test",
      reason: outcome.reason,
      status: outcome.status,
    });
    return { ok: false, reason: `Resend rejected the test: ${outcome.reason}.` };
  }

  return { ok: true, simulated: outcome.simulated };
}
