import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_MAX_DAYS } from "@/lib/auth/constants";
import { clampSessionMaxAgeSeconds, getSessionCookieOptions } from "@/lib/auth/session";

describe("session cookie flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is http-only, SameSite=Lax, scoped to the site and high priority", () => {
    const options = getSessionCookieOptions(3600);

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
      priority: "high",
    });
  });

  it("is Secure whenever the deployment is production (including Vercel)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(getSessionCookieOptions(60).secure).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieOptions(60).secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getSessionCookieOptions(60).secure).toBe(true);
  });

  it("never lets the browser cookie outlive Firebase's 14-day maximum", () => {
    expect(SESSION_COOKIE_MAX_DAYS).toBe(14);
    expect(clampSessionMaxAgeSeconds(30)).toBe(14 * 24 * 60 * 60);
    expect(clampSessionMaxAgeSeconds(5)).toBe(5 * 24 * 60 * 60);
    expect(clampSessionMaxAgeSeconds(0)).toBe(24 * 60 * 60);
    expect(clampSessionMaxAgeSeconds(Number.NaN)).toBe(5 * 24 * 60 * 60);
  });
});
