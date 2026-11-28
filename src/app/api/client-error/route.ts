// GCC - client error reporting endpoint.
//
// Receives sanitized client boundary errors and logs them with a reference id.
// No secrets/PII should be sent; payload is size-limited and redacted.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { clientIdentifier, jsonError } from "@/lib/http/respond";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const schema = z
  .object({
    message: z.string().max(500).optional(),
    digest: z.string().max(200).optional(),
    name: z.string().max(120).optional(),
    page: z.string().max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) return jsonError("Cross-origin request rejected.", 403);
    throw error;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy("client-error", clientIdentifier(request), 30, 60),
  );
  if (!limit.allowed) {
    return jsonError("Too many reports.", 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid report.", 400);

  const reference = logger.error(
    "client.error_boundary",
    new Error(parsed.data.message ?? "Client error"),
    {
      route: "/api/client-error",
      digest: parsed.data.digest ?? null,
      errorName: parsed.data.name ?? null,
      page: parsed.data.page ?? null,
    },
  );
  return NextResponse.json({ reference }, { status: 200 });
}
