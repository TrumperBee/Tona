// GCC - exact CSP directive coverage for nonce, bot checks and media hosts.
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, cspHeaderName, resolveCspMode } from "./csp";

const nonce = "abc123def456";

describe("buildContentSecurityPolicy", () => {
  const enforce = buildContentSecurityPolicy({
    nonce,
    mode: "enforce",
    isProduction: true,
  });

  it("uses a per-request nonce with strict-dynamic", () => {
    expect(enforce).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(enforce).toContain("script-src-attr 'none'");
    expect(enforce).not.toContain("'unsafe-eval'");
  });

  it("allows only the exact provider endpoints needed by client SDKs", () => {
    for (const host of [
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://content-firebaseappcheck.googleapis.com",
      "https://challenges.cloudflare.com",
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
    ]) {
      expect(enforce).toContain(host);
    }

    expect(enforce).not.toContain("*.");
    expect(enforce).not.toContain("wss://");
    expect(enforce).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  });

  it("keeps media exports working without allowing arbitrary hosts", () => {
    expect(enforce).toContain("img-src 'self' data: blob: https://res.cloudinary.com");
    expect(enforce).toMatch(/connect-src[^;]*https:\/\/res\.cloudinary\.com/);
    expect(enforce).toContain("style-src 'self'");
    expect(enforce).toContain(`'nonce-${nonce}'`);
    expect(enforce).toContain("worker-src 'self' blob:");
  });

  it("locks down navigation and plugin surfaces", () => {
    for (const directive of [
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
      "report-uri /api/csp-report",
    ]) {
      expect(enforce).toContain(directive);
    }
  });

  it("allows dev-only eval and omits upgrade-insecure-requests outside production", () => {
    const development = buildContentSecurityPolicy({
      nonce,
      mode: "report-only",
      isProduction: false,
    });

    expect(development).toContain("'unsafe-eval'");
    expect(development).not.toContain("upgrade-insecure-requests");
  });
});

describe("CSP mode", () => {
  it("maps modes to the correct response header", () => {
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
  });

  it("defaults to enforce in production and report-only in development", () => {
    expect(resolveCspMode(undefined, true)).toBe("enforce");
    expect(resolveCspMode(undefined, false)).toBe("report-only");
    expect(resolveCspMode("report-only", true)).toBe("report-only");
    expect(resolveCspMode("enforce", false)).toBe("enforce");
    expect(resolveCspMode("nonsense", true)).toBe("enforce");
  });
});
