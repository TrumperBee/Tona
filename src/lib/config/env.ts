// GCC — validated public environment variables.
//
// This module is safe to import from both server and client code, but only
// exposes values prefixed with NEXT_PUBLIC_. Server-only secrets live in
// `env.server.ts`, which is guarded by the `server-only` package.
//
// Validation is lazy (on first access) so that `next build` in CI does not
// require secrets merely to compile the application. Public Firebase values are
// still required before the browser client can initialise.
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const DEVELOPMENT_SITE_URL = "http://localhost:3000";
const FALLBACK_EHUBMARKET_URL = "https://ehubmarket.me/";

/** Treats blank or whitespace-only values as unset. */
function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_FIREBASE_API_KEY: z.preprocess(blankToUndefined, z.string().min(1)),
    // Firebase authDomain is a hostname, not a URL (no scheme).
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.preprocess(blankToUndefined, z.string().min(1)),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.preprocess(blankToUndefined, z.string().min(1)),
    // Optional and unused for now: file storage is out of scope on the Spark plan.
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.preprocess(
      blankToUndefined,
      z.string().min(1).optional(),
    ),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.preprocess(blankToUndefined, z.string().min(1)),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.preprocess(blankToUndefined, z.string().min(1)),
    // A blank site URL is tolerated in development and rejected in production.
    NEXT_PUBLIC_SITE_URL: z.preprocess(blankToUndefined, z.url().optional()),
    NEXT_PUBLIC_EHUBMARKET_URL: z.preprocess(blankToUndefined, z.url().optional()),
  })
  .transform((value) => ({
    ...value,
    NEXT_PUBLIC_SITE_URL: value.NEXT_PUBLIC_SITE_URL ?? DEVELOPMENT_SITE_URL,
    NEXT_PUBLIC_EHUBMARKET_URL: value.NEXT_PUBLIC_EHUBMARKET_URL ?? FALLBACK_EHUBMARKET_URL,
  }));

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Raised when one or more environment variables are missing or invalid. */
export class EnvironmentError extends Error {
  constructor(
    scope: "public" | "server",
    issues: readonly { path: PropertyKey[]; message: string }[],
  ) {
    const details = issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    super(
      `Invalid ${scope} environment configuration:\n${details}\n\n` +
        "Copy .env.example to .env.local and provide the required values.",
    );
    this.name = "EnvironmentError";
  }
}

let cachedPublicEnv: PublicEnv | undefined;

/**
 * Returns the validated public environment.
 *
 * Reads each variable explicitly (never dynamically) so Next.js can inline
 * NEXT_PUBLIC_* values into the browser bundle.
 *
 * @throws {EnvironmentError} when a required public variable is missing or invalid.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  // Production deployments need a canonical absolute URL for metadata, auth
  // redirects and same-origin checks. A blank value is a configuration error,
  // not a signal to fall back to localhost.
  if (isProduction && blankToUndefined(process.env.NEXT_PUBLIC_SITE_URL) === undefined) {
    throw new EnvironmentError("public", [
      {
        path: ["NEXT_PUBLIC_SITE_URL"],
        message:
          "NEXT_PUBLIC_SITE_URL is required in production builds. Set it to the canonical deployment URL, for example https://tona-olive.vercel.app (no trailing slash).",
      },
    ]);
  }

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_EHUBMARKET_URL: process.env.NEXT_PUBLIC_EHUBMARKET_URL,
  });

  if (!parsed.success) {
    throw new EnvironmentError("public", parsed.error.issues);
  }

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}
