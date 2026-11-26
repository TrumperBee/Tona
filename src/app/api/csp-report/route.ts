// GCC - Content-Security-Policy violation reports.
//
// Browsers post here from pages (and from cross-origin frames), so this route
// deliberately does not use the same-origin guard. It is rate limited, rejects
// oversized bodies and logs only the directive and a path - never the full
// document URL, blocked URL, query string or any user data.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";

const reportBodySchema = z
  .object({
    effectiveDirective: z.string().max(120).optional(),
    documentURL: z.string().max(2048).optional(),
  })
  .passthrough();

const reportSchema = z.union([
  z
    .array(z.object({ type: z.literal("csp-violation"), body: reportBodySchema }).passthrough())
    .max(20),
  z
    .object({
      "csp-report": z
        .object({
          "violated-directive": z.string().max(120).optional(),
          "effective-directive": z.string().max(120).optional(),
          "document-uri": z.string().max(2048).optional(),
        })
        .passthrough(),
    })
    .strict(),
]);

export const runtime = "nodejs";

const MAX_REPORT_BYTES = 16 * 1024;

function safePath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value.startsWith("/") ? (value.split("?")[0]?.split("#")[0] ?? null) : null;
  }
}

function safeDirective(value: unknown): string | null {
  return typeof value === "string" && value.length <= 120 ? value.replace(/[^\w-]/g, "") : null;
}

interface NormalisedReport {
  readonly directive: string | null;
  readonly documentPath: string | null;
}

function normaliseReport(payload: unknown): NormalisedReport[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  // Reporting API: [{ type: "csp-violation", body: { ... } }]
  if (Array.isArray(payload)) {
    return payload
      .map((entry): NormalisedReport | null => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const record = entry as { type?: unknown; body?: Record<string, unknown> };
        if (record.type !== "csp-violation" || !record.body) {
          return null;
        }

        return {
          directive: safeDirective(record.body.effectiveDirective),
          documentPath: safePath(record.body.documentURL),
        };
      })
      .filter((entry): entry is NormalisedReport => entry !== null);
  }

  // Legacy report-uri: { "csp-report": { ... } }
  const legacy = (payload as { "csp-report"?: Record<string, unknown> })["csp-report"];

  if (!legacy) {
    return [];
  }

  return [
    {
      directive: safeDirective(legacy["violated-directive"] ?? legacy["effective-directive"]),
      documentPath: safePath(legacy["document-uri"]),
    },
  ];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limit = await checkRateLimit(
    rateLimitPolicy("csp-report", clientIdentifier(request), 60, 60),
  );

  if (!limit.allowed) {
    return jsonError("Too many reports.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
    return jsonError("Report too large.", 413);
  }

  const text = await request.text();

  if (text.length > MAX_REPORT_BYTES) {
    return jsonError("Report too large.", 413);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    return jsonError("Invalid report.", 400);
  }

  const parsed = reportSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonError("Invalid report.", 400);
  }

  for (const report of normaliseReport(parsed.data)) {
    // No PII: no document URL query, no blocked URL, no user agent.
    console.warn("[csp]", report.directive ?? "unknown-directive", report.documentPath ?? "-");
  }

  return new NextResponse(null, { status: 204 });
}
