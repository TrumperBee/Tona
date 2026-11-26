// GCC - Content-Security-Policy builder.
//
// One policy is produced per request so Next.js can attach the same nonce to
// its own scripts. This module is pure (no server-only import) so the exact
// directive set can be unit-tested.
//
// Deliberate allowances:
// - style-src keeps 'unsafe-inline' because React style attributes and the
//   graphics export cannot be nonced. Everything else is nonce or origin based.
// - connect-src lists the exact Firebase/Google endpoints used by Auth,
//   Firestore, App Check and the Turnstile/reCAPTCHA challenge.
// - img-src allows Cloudinary delivery and data:/blob: for avatar previews and
//   html-to-image output.
export type CspMode = "report-only" | "enforce";

export const CSP_REPORT_PATH = "/api/csp-report";

// Exact endpoints used by the browser SDKs. Wildcards would let an injected
// script talk to any Google subdomain, so only the known hosts are listed.
const FIREBASE_CONNECT = [
  "'self'",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
];

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com";
const RECAPTCHA_CONNECT = [
  "https://www.google.com/recaptcha/",
  "https://www.gstatic.com/recaptcha/",
];

export interface CspOptions {
  readonly nonce: string;
  readonly mode: CspMode;
  readonly isProduction: boolean;
}

export function buildContentSecurityPolicy({ nonce, isProduction }: CspOptions): string {
  void ({} as Pick<CspOptions, "mode">);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      TURNSTILE_SCRIPT,
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
      // Next's dev overlay uses inline eval. Production never receives this.
      ...(isProduction ? [] : ["'unsafe-eval'"]),
    ],
    "script-src-attr": ["'none'"],
    // React style attributes need 'unsafe-inline'; nonce covers style tags.
    "style-src": ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": [...FIREBASE_CONNECT, TURNSTILE_SCRIPT, ...RECAPTCHA_CONNECT],
    "frame-src": [
      TURNSTILE_SCRIPT,
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
      "https://recaptcha.google.com/recaptcha/",
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_PATH],
    ...(isProduction ? { "upgrade-insecure-requests": [] } : {}),
  };

  const body = Object.entries(directives)
    .map(([name, values]) => (values.length === 0 ? name : `${name} ${values.join(" ")}`))
    .join("; ");

  return body;
}

/** Header name for the selected mode. */
export function cspHeaderName(mode: CspMode): string {
  return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/** Resolves the configured mode without throwing on an invalid value. */
export function resolveCspMode(raw: string | undefined, isProduction: boolean): CspMode {
  const value = raw?.trim().toLowerCase();

  if (value === "report-only" || value === "enforce") {
    return value;
  }

  // Production defaults to enforcement. A deployment can start in report-only
  // by setting CSP_MODE=report-only, observe /api/csp-report, then remove it.
  return isProduction ? "enforce" : "report-only";
}
