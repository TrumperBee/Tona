import { describe, expect, it } from "vitest";

import { assertSameOrigin, SameOriginError, isSameOrigin } from "@/lib/security/same-origin";

const SITE = "https://tona-olive.vercel.app";
const ENDPOINT = `${SITE}/api/auth/session`;

function request(method: string, url = ENDPOINT, headers: Record<string, string> = {}): Request {
  return new Request(url, { method, headers });
}

describe("assertSameOrigin", () => {
  it("accepts state-changing requests whose Origin matches the site", () => {
    expect(isSameOrigin(request("POST", ENDPOINT, { origin: SITE }), SITE)).toBe(true);
    expect(isSameOrigin(request("DELETE", ENDPOINT, { origin: SITE }), SITE)).toBe(true);
    expect(() =>
      assertSameOrigin(request("PATCH", ENDPOINT, { origin: SITE }), SITE),
    ).not.toThrow();
  });

  it("accepts a same-origin Referer when Origin is absent", () => {
    expect(
      isSameOrigin(request("POST", ENDPOINT, { referer: `${SITE}/login?next=%2Fdashboard` }), SITE),
    ).toBe(true);
  });

  it("rejects cross-origin Origins and a missing Origin/Referer", () => {
    expect(isSameOrigin(request("POST", ENDPOINT, { origin: "https://evil.example" }), SITE)).toBe(
      false,
    );
    expect(isSameOrigin(request("POST", ENDPOINT, { origin: "null" }), SITE)).toBe(false);
    expect(isSameOrigin(request("POST", ENDPOINT), SITE)).toBe(false);
    expect(() => assertSameOrigin(request("POST", ENDPOINT), SITE)).toThrow(SameOriginError);
  });

  it("rejects scheme and port mismatches", () => {
    expect(
      isSameOrigin(request("POST", ENDPOINT, { origin: "http://tona-olive.vercel.app" }), SITE),
    ).toBe(false);
    expect(
      isSameOrigin(
        request("POST", ENDPOINT, { origin: "https://tona-olive.vercel.app:8443" }),
        SITE,
      ),
    ).toBe(false);
  });

  it("rejects a matching Origin when the request host is different", () => {
    const internal = "https://internal.example/api/auth/session";
    expect(isSameOrigin(request("POST", internal, { origin: SITE }), SITE)).toBe(false);
  });

  it("does not block safe methods", () => {
    expect(isSameOrigin(request("GET", ENDPOINT, { origin: "https://evil.example" }), SITE)).toBe(
      true,
    );
    expect(isSameOrigin(request("HEAD", ENDPOINT), SITE)).toBe(true);
    expect(isSameOrigin(request("OPTIONS", ENDPOINT), SITE)).toBe(true);
  });
});
