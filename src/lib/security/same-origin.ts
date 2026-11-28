// GCC — same-origin request guard for state-changing routes.
//
// Every future POST/PATCH/PUT/DELETE route must call assertSameOrigin() before
// reading a body or mutating state. Browsers send Origin on cross-origin
// requests; a request without Origin or a matching Referer is rejected.
//
// This module is server-only by convention. It is not marked with the
// `server-only` package because the pure helper is unit-tested in Node.

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface SameOriginRequest {
  readonly method?: string;
  readonly url: string;
  readonly headers: {
    get(name: string): string | null;
  };
}

export class SameOriginError extends Error {
  readonly status = 403;

  constructor(message = "Cross-origin request rejected.") {
    super(message);
    this.name = "SameOriginError";
  }
}

function configuredOrigin(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return siteUrl ? siteUrl : null;
}

/**
 * True when a safe method is used, or when a state-changing request carries an
 * Origin (or Referer fallback) that matches the configured site origin and the
 * request URL host.
 */
export function isSameOrigin(request: SameOriginRequest, expectedOrigin?: string): boolean {
  const method = (request.method ?? "GET").toUpperCase();
  if (!STATE_CHANGING_METHODS.has(method)) return true;

  let expectedValue = expectedOrigin ?? configuredOrigin();
  let requestUrl: URL | null = null;
  try {
    requestUrl = new URL(request.url);
  } catch {
    requestUrl = null;
  }
  if (!expectedValue && requestUrl) expectedValue = requestUrl.origin;
  if (!expectedValue) return false;

  let expectedUrl: URL;
  try {
    expectedUrl = new URL(expectedValue);
  } catch {
    return false;
  }

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return false;
  }

  // Trust only the configured site origin, and reject when the request target
  // host is different. Normalize localhost/127.0.0.1 for local dev/E2E.
  const norm = (o: string) => o.replace("://localhost", "://127.0.0.1");
  const sourceOk = norm(sourceUrl.origin) === norm(expectedUrl.origin);
  if (!sourceOk) return false;
  if (requestUrl && norm(requestUrl.origin) !== norm(expectedUrl.origin)) return false;
  return true;
}

/** Throws SameOriginError unless the request is same-origin. */
export function assertSameOrigin(request: SameOriginRequest, expectedOrigin?: string): void {
  if (!isSameOrigin(request, expectedOrigin)) {
    throw new SameOriginError();
  }
}
