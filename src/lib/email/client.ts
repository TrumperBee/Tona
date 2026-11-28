// GCC - Resend REST client.
//
// No SDK and no dependency: two endpoints, a timeout and one delayed retry for
// HTTP 429. Failures never throw so a notification-triggering action cannot be
// undone by an email problem. Logs never contain an address or a body.
import "server-only";

import { CONTACT_EMAIL } from "@/lib/config/site";
import { getEmailConfig, isEmailConfigured } from "@/lib/email/config";
import { logger } from "@/lib/observability/logger";
import { captureEmail, isEmailCaptureEnabled } from "@/lib/test-harness";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
export const RESEND_BATCH_LIMIT = 100;
export const EMAIL_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 1_000;

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Used only for diagnostics and failure logs, never the address. */
  readonly kind?: string;
}

export type EmailSendOutcome =
  | { readonly ok: true; readonly simulated: boolean }
  | { readonly ok: false; readonly reason: string; readonly status: number | null };

export interface ResendBody {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly reply_to?: string;
}

let missingConfigLogged = false;

/** Masks an address for logs and settings: `a***@example.com`. */
export function maskEmail(email: string | null | undefined): string {
  const trimmed = email?.trim() ?? "";
  const at = trimmed.lastIndexOf("@");

  if (at <= 0) {
    return trimmed ? "***" : "";
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function buildBody(message: EmailMessage, from: string): ResendBody {
  return {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.headers ? { headers: message.headers } : {}),
    ...(CONTACT_EMAIL ? { reply_to: CONTACT_EMAIL } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function retryDelay(response: Response): number {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : RETRY_DELAY_MS;
}

async function postJson(url: string, body: unknown, apiKey: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });
}

function logSimulated(message: EmailMessage): void {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return;
  }

  // Development only: show enough to verify the template without storing a
  // full address or a full body in a shared log.
  logger.info("email.simulated", {
    to: maskEmail(message.to),
    subject: message.subject,
    kind: message.kind ?? null,
  });
}

function missingConfig(): EmailSendOutcome {
  if (process.env.NODE_ENV === "production") {
    if (!missingConfigLogged) {
      missingConfigLogged = true;
      logger.error("email.config_missing", new Error("RESEND_API_KEY or RESEND_FROM is missing"), {
        route: "email.client",
      });
    }

    return { ok: false, reason: "email_not_configured", status: null };
  }

  return { ok: true, simulated: true };
}

async function requestOne(message: EmailMessage): Promise<EmailSendOutcome> {
  if (isEmailCaptureEnabled()) {
    captureEmail({
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      kind: message.kind,
      headers: message.headers,
      capturedAt: new Date().toISOString(),
    });
    return { ok: true, simulated: true };
  }

  const config = getEmailConfig();

  if (!isEmailConfigured(config) || !config.apiKey || !config.from) {
    logSimulated(message);
    return missingConfig();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await postJson(
        RESEND_ENDPOINT,
        buildBody(message, config.from),
        config.apiKey,
      );

      if (response.ok) {
        return { ok: true, simulated: false };
      }

      if (response.status === 429 && attempt === 0) {
        await sleep(retryDelay(response));
        continue;
      }

      return {
        ok: false,
        reason: `resend_${response.status}`,
        status: response.status,
      };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error";
      return { ok: false, reason, status: null };
    }
  }

  return { ok: false, reason: "resend_429", status: 429 };
}

/** Sends one message. Never throws. */
export async function sendEmail(message: EmailMessage): Promise<EmailSendOutcome> {
  return requestOne(message);
}

/**
 * Sends up to 100 messages in one Resend batch request. Anything larger is
 * chunked. One failed chunk does not stop later chunks.
 */
export async function sendEmailBatch(
  messages: readonly EmailMessage[],
): Promise<readonly EmailSendOutcome[]> {
  if (messages.length === 0) return [];
  if (messages.length === 1) return [await requestOne(messages[0])];

  if (isEmailCaptureEnabled()) {
    for (const message of messages) {
      captureEmail({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        kind: message.kind,
        headers: message.headers,
        capturedAt: new Date().toISOString(),
      });
    }
    return messages.map(() => ({ ok: true as const, simulated: true }));
  }

  const config = getEmailConfig();
  const outcomes: EmailSendOutcome[] = [];

  for (let offset = 0; offset < messages.length; offset += RESEND_BATCH_LIMIT) {
    const chunk = messages.slice(offset, offset + RESEND_BATCH_LIMIT);

    if (!isEmailConfigured(config) || !config.apiKey || !config.from) {
      chunk.forEach(logSimulated);
      const outcome = missingConfig();
      outcomes.push(...chunk.map(() => outcome));
      continue;
    }

    let settled = false;

    for (let attempt = 0; attempt < 2 && !settled; attempt += 1) {
      try {
        const response = await postJson(
          RESEND_BATCH_ENDPOINT,
          chunk.map((message) => buildBody(message, config.from as string)),
          config.apiKey,
        );

        if (response.ok) {
          outcomes.push(...chunk.map(() => ({ ok: true as const, simulated: false })));
          settled = true;
          continue;
        }

        if (response.status === 429 && attempt === 0) {
          await sleep(retryDelay(response));
          continue;
        }

        outcomes.push(
          ...chunk.map(() => ({
            ok: false as const,
            reason: `resend_${response.status}`,
            status: response.status,
          })),
        );
        settled = true;
      } catch (error) {
        const reason =
          error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error";
        outcomes.push(...chunk.map(() => ({ ok: false as const, reason, status: null })));
        settled = true;
      }
    }

    if (!settled) {
      outcomes.push(
        ...chunk.map(() => ({ ok: false as const, reason: "resend_429", status: 429 })),
      );
    }
  }

  return outcomes;
}
