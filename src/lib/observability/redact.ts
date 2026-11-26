// GCC - redaction helpers for structured logs.
//
// Logs must never contain secrets or personal data. This module redacts common
// sensitive values before they reach console/Vercel logs. It is intentionally
// conservative: unknown long tokens are partially masked.
import "server-only";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const E164_RE = /\+?[1-9]\d{7,14}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const COOKIE_RE = /\b(__session|gcc_session|session|token|refresh_token|id_token)=([^;\s]+)/gi;
const PRIVATE_KEY_RE =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "token",
  "idtoken",
  "refreshtoken",
  "sessioncookie",
  "cookie",
  "authorization",
  "apikey",
  "api_key",
  "secret",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
  "resendapikey",
  "resend_api_key",
  "turnstilesecret",
  "turnstile_secret",
  "cloudinaryapisecret",
  "cloudinary_api_secret",
  "email",
  "whatsappe164",
  "phonenumber",
  "phone",
]);

function maskEmail(value: string): string {
  const at = value.lastIndexOf("@");
  if (at <= 1) return "***@***";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "[redacted-phone]";
  return `+[redacted-phone:${digits.slice(-2)}]`;
}

export function redactString(value: string): string {
  return value
    .replace(PRIVATE_KEY_RE, "[redacted-private-key]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(COOKIE_RE, "$1=[redacted]")
    .replace(EMAIL_RE, (m) => maskEmail(m))
    .replace(E164_RE, (m) => (m.includes("[redacted") ? m : maskPhone(m)));
}

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : redactString(value.stack ?? "").slice(0, 4000),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      out[k] = shouldRedactKey(k) ? "[redacted]" : redactValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
