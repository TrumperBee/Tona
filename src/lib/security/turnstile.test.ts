// GCC - server-side Turnstile verification: fail closed, bind action and IP.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  secret: undefined as string | undefined,
}));

vi.mock("@/lib/config/env.server", () => ({
  getServerEnv: () => ({ TURNSTILE_SECRET_KEY: state.secret }),
}));

import { verifyTurnstile } from "./turnstile";

const options = {
  token: "challenge-token",
  ip: "203.0.113.10",
  action: "register",
} as const;

function mockVerify(body: unknown, ok = true) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    state.secret = "test-secret";
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    state.secret = undefined;
  });

  it("skips with a notice in development when the secret is missing", async () => {
    state.secret = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile(options)).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when the secret is missing", async () => {
    state.secret = undefined;
    vi.stubEnv("NODE_ENV", "production");

    await expect(verifyTurnstile(options)).resolves.toEqual({
      ok: false,
      reason: "missing-secret",
    });
  });

  it("rejects a missing token", async () => {
    await expect(verifyTurnstile({ ...options, token: undefined })).resolves.toEqual({
      ok: false,
      reason: "missing-token",
    });
  });

  it("posts the secret, token and client IP to Cloudflare", async () => {
    const fetchMock = mockVerify({ success: true, action: "register" });

    await expect(verifyTurnstile(options)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("challenge-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("rejects failed verification and action mismatch", async () => {
    mockVerify({ success: false, "error-codes": ["bad-response"] });
    await expect(verifyTurnstile(options)).resolves.toEqual({
      ok: false,
      reason: "verification-failed",
    });

    mockVerify({ success: true, action: "login" });
    await expect(verifyTurnstile(options)).resolves.toEqual({
      ok: false,
      reason: "action-mismatch",
    });
  });

  it("returns a network error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(verifyTurnstile(options)).resolves.toEqual({
      ok: false,
      reason: "network-error",
    });
  });
});
