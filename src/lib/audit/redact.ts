// GCC - redaction for audit before/after JSON.
//
// Audit entries may contain account details. The viewer redacts obvious
// personal and secret keys before rendering, even for the Super Admin.
import type { Timestamp } from "firebase-admin/firestore";

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|private.?key|whatsapp|phone|contact|email/i;
const REDACTED = "[redacted]";

function isTimestamp(value: unknown): value is Timestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
}

/**
 * Returns a JSON-safe copy with sensitive keys redacted and timestamps
 * converted to ISO strings. Depth is capped so a malicious or malformed entry
 * cannot create an enormous render.
 */
export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactAuditValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactAuditValue(item, depth + 1);
    }

    return result;
  }

  return value;
}

/** Pretty JSON for display, already redacted. */
export function auditValueToJson(value: unknown): string {
  return JSON.stringify(redactAuditValue(value), null, 2);
}
