// GCC — validated server-only environment variables.
//
// The `server-only` import makes this module fail at build time if it is ever
// pulled into a client component. Never re-export these values from a module
// that client code can import.
import "server-only";

import { z } from "zod";

import { EnvironmentError, getPublicEnv, type PublicEnv } from "./env";

/** Treats blank or whitespace-only values as unset. */
function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().length > 0 ? value.trim() : undefined;
}

const serverEnvSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
  // The sole Super Admin. This address must never be hardcoded in source.
  SUPER_ADMIN_EMAIL: z.email().transform((value) => value.trim().toLowerCase()),
  // The same account's Firebase uid. Super admin is granted only when email and
  // uid both match; a missing value fails closed for everyone (ADR-047).
  SUPER_ADMIN_UID: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  // Session cookie lifetime in days. Defaults to five days.
  SESSION_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(30).default(5),
  // Cloudinary credentials are server-only. The client never sees them.
  // Optional at the environment level so auth still works in environments
  // where avatar upload has not been configured yet; the avatar route reports
  // a clear configuration error instead.
  CLOUDINARY_CLOUD_NAME: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  CLOUDINARY_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  CLOUDINARY_API_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  // Resend and email delivery. Optional so the app still boots (and the in-app
  // notification centre still works) when email has not been configured yet.
  RESEND_API_KEY: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  RESEND_FROM: z.preprocess(blankToUndefined, z.string().trim().min(3).optional()),
  RESEND_WEBHOOK_SECRET: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  EMAIL_UNSUBSCRIBE_SECRET: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  // Daily hard limit and the monthly reference used for the 80% warning.
  EMAIL_DAILY_LIMIT: z.coerce.number().int().min(1).max(100000).default(100),
  EMAIL_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(1000000).default(3000),
  // Cloudflare Turnstile secret. Optional so the app still boots; production
  // rejects protected form submissions when it is missing (fail closed).
  TURNSTILE_SECRET_KEY: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
});

const serverOnlySchemaKeys = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "SUPER_ADMIN_EMAIL",
  "SUPER_ADMIN_UID",
  "SESSION_COOKIE_MAX_AGE_DAYS",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_UNSUBSCRIBE_SECRET",
  "EMAIL_DAILY_LIMIT",
  "EMAIL_MONTHLY_LIMIT",
  "TURNSTILE_SECRET_KEY",
] as const;

export type ServerEnv = PublicEnv & z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Returns the validated server-only environment.
 *
 * @throws {EnvironmentError} when a required server variable is missing or invalid.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_UID: process.env.SUPER_ADMIN_UID,
    SESSION_COOKIE_MAX_AGE_DAYS: process.env.SESSION_COOKIE_MAX_AGE_DAYS,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET,
    EMAIL_DAILY_LIMIT: process.env.EMAIL_DAILY_LIMIT,
    EMAIL_MONTHLY_LIMIT: process.env.EMAIL_MONTHLY_LIMIT,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  });

  if (!parsed.success) {
    throw new EnvironmentError("server", parsed.error.issues);
  }

  cachedServerEnv = { ...getPublicEnv(), ...parsed.data };
  return cachedServerEnv;
}

/** Keys that must never appear in a client bundle. Used by security tests later. */
export const SERVER_ONLY_ENV_KEYS: readonly string[] = serverOnlySchemaKeys;
