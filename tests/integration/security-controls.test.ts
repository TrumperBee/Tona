// GCC - emulator-backed proofs for the Phase 18A controls that cannot be
// verified by static source scans: CSP response/request headers, PII-free CSP
// reporting, failed-sign-in state and hashed rate-limit documents.
import { createHash } from "node:crypto";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginFailureCount, loginFailurePolicy } from "@/lib/auth/login-attempts";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { proxy } from "@/proxy";

import * as cspReportRoute from "@/app/api/csp-report/route";
import * as loginAttemptRoute from "@/app/api/auth/login-attempt/route";

const EMAIL = "Attempt.User@Example.com";
const IP = "203.0.113.42";
const NONCE_HEADER = "x-middleware-request-content-security-policy";

function request(path: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "x-forwarded-for": IP,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function clearRateLimits(): Promise<void> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.rateLimits()).get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

describe("CSP headers", () => {
  const originalMode = process.env.CSP_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.CSP_MODE;
    } else {
      process.env.CSP_MODE = originalMode;
    }
  });

  it("stamps the nonce request header in report-only mode and reports only in the response", () => {
    process.env.CSP_MODE = "report-only";
    const response = proxy(new NextRequest("http://localhost:3000/login"));

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain(
      "script-src-attr 'none'",
    );
    expect(response.headers.get("X-CSP-Mode")).toBe("report-only");
    // Next reads the *request* CSP header to nonce its scripts. It must be
    // present even though the response header is report-only.
    expect(response.headers.get(NONCE_HEADER)).toContain("'strict-dynamic'");
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "content-security-policy",
    );
  });

  it("enforces by default in production and still carries CSP on navigation redirects", () => {
    const nodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.CSP_MODE;

    try {
      const response = proxy(new NextRequest("http://localhost:3000/dashboard"));
      expect(response.status).toBe(307);
      expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("X-CSP-Mode")).toBe("enforce");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
    }
  });

  it("keeps the nonce request header on protected pages that render", () => {
    process.env.CSP_MODE = "report-only";
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: "gcc_session=signed-in" },
    });
    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get(NONCE_HEADER)).toContain("'strict-dynamic'");
  });
});

describe("CSP reports", () => {
  beforeEach(async () => {
    await clearRateLimits();
  });

  it("accepts both report formats and logs only directive and pathname", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const legacy = await cspReportRoute.POST(
      request("/api/csp-report", {
        "csp-report": {
          "violated-directive": "script-src-elem",
          "document-uri": "https://example.test/dashboard?token=secret&user=alice",
          "blocked-uri": "https://evil.invalid/steal?secret=1",
        },
      }),
    );
    const reportingApi = await cspReportRoute.POST(
      request("/api/csp-report", [
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "img-src",
            documentURL: "https://example.test/players/alice?q=private",
            blockedURL: "https://evil.invalid/track.gif?private=yes",
          },
        },
      ]),
    );

    expect(legacy.status).toBe(204);
    expect(reportingApi.status).toBe(204);
    const logged = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("[csp] script-src-elem /dashboard");
    expect(logged).toContain("[csp] img-src /players/alice");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("private");
    expect(logged).not.toContain("evil.invalid");
    warn.mockRestore();
  });

  it("rejects oversized and malformed reports", async () => {
    const oversized = await cspReportRoute.POST(
      request("/api/csp-report", undefined, {
        "content-type": "application/json",
        "content-length": String(17 * 1024),
      }),
    );
    const malformed = await cspReportRoute.POST(request("/api/csp-report", { unexpected: true }));

    expect(oversized.status).toBe(413);
    expect(malformed.status).toBe(400);
  });

  it("limits report posts per client", async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await cspReportRoute.POST(request("/api/csp-report", { "csp-report": {} }));
      expect(response.status).toBe(204);
    }

    const denied = await cspReportRoute.POST(request("/api/csp-report", { "csp-report": {} }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("failed sign-in challenge", () => {
  beforeEach(async () => {
    await clearRateLimits();
  });

  it("requires Turnstile after three failures and clears it on success", async () => {
    const post = (event: "check" | "failed" | "success") =>
      loginAttemptRoute.POST(request("/api/auth/login-attempt", { email: EMAIL, event }));

    expect((await (await post("check")).json()).challengeRequired).toBe(false);

    expect((await (await post("failed")).json()).challengeRequired).toBe(false);
    expect((await (await post("failed")).json()).challengeRequired).toBe(false);
    expect((await (await post("failed")).json()).challengeRequired).toBe(true);
    expect((await (await post("check")).json()).challengeRequired).toBe(true);
    expect(await loginFailureCount(IP, EMAIL)).toBe(3);

    expect((await (await post("success")).json()).challengeRequired).toBe(false);
    expect(await loginFailureCount(IP, EMAIL)).toBe(0);
  });

  it("stores only a hash of the email and a hash of the key", async () => {
    await loginAttemptRoute.POST(
      request("/api/auth/login-attempt", { email: EMAIL, event: "failed" }),
    );

    const expectedId = createHash("sha256")
      .update(`${loginFailurePolicy(IP, EMAIL).key}`)
      .digest("hex");
    const document = await getFirebaseAdminFirestore()
      .collection(paths.rateLimits())
      .doc(expectedId)
      .get();

    expect(document.exists).toBe(true);
    const data = document.data() ?? {};
    expect(JSON.stringify(data)).not.toContain(EMAIL);
    expect(JSON.stringify(data).toLowerCase()).not.toContain(IP);
    expect(data.fingerprint).toBe(expectedId.slice(0, 12));
    expect(data.expiresAt).toBeTruthy();
  });

  it("keeps readable identifiers out of generic rate-limit documents", async () => {
    const policy = rateLimitPolicy("proof:pii", "user@example.com", 5, 60);
    await checkRateLimit(policy);
    const expectedId = createHash("sha256").update(policy.key).digest("hex");
    const document = await getFirebaseAdminFirestore()
      .collection(paths.rateLimits())
      .doc(expectedId)
      .get();

    expect(JSON.stringify(document.data())).not.toContain("user@example.com");
  });
});
