// GCC — validated public environment variables.
//
// This module is safe to import from both server and client code, but only
// exposes values prefixed with NEXT_PUBLIC_. Server-only secrets live in
// `env.server.ts`, which is guarded by the `server-only` package.
//
// Validation is lazy (on first access) so that `next build` in CI does not
// require secrets merely to compile the application.
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  // Firebase authDomain is a hostname, not a URL (no scheme).
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  // Optional and unused for now: file storage is out of scope on the Spark plan.
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_EHUBMARKET_URL: z.url(),
});

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
