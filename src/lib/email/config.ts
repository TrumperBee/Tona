// GCC - server-only email configuration.
//
// Every Resend value is optional at boot so a deployment without email keeps
// working. The client never imports this module.
import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

export interface EmailConfig {
  readonly apiKey: string | null;
  readonly from: string | null;
  readonly webhookSecret: string | null;
  readonly unsubscribeSecret: string | null;
  readonly dailyLimit: number;
  readonly monthlyLimit: number;
}

export function getEmailConfig(): EmailConfig {
  const env = getServerEnv();

  return {
    apiKey: env.RESEND_API_KEY ?? null,
    from: env.RESEND_FROM ?? null,
    webhookSecret: env.RESEND_WEBHOOK_SECRET ?? null,
    unsubscribeSecret: env.EMAIL_UNSUBSCRIBE_SECRET ?? null,
    dailyLimit: env.EMAIL_DAILY_LIMIT,
    monthlyLimit: env.EMAIL_MONTHLY_LIMIT,
  };
}

/** True when a real Resend request can be made. */
export function isEmailConfigured(config = getEmailConfig()): boolean {
  return Boolean(config.apiKey && config.from);
}

/** True when signed unsubscribe links can be minted and verified. */
export function hasUnsubscribeSecret(config = getEmailConfig()): boolean {
  return Boolean(config.unsubscribeSecret);
}
