// GCC — public link configuration rejects executable URL schemes.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public link configuration", () => {
  it("rejects javascript:, data: and remote http links", async () => {
    for (const unsafe of [
      "javascript:alert(1)",
      "data:text/html,<script>x</script>",
      "http://evil.example",
    ]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_EHUBMARKET_URL", unsafe);
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", unsafe);

      const site = await import("@/lib/config/site");

      expect(site.EHUBMARKET_URL).toBe("https://ehubmarket.me/");
      expect(site.SITE_URL).toBe("http://localhost:3000");
    }
  });

  it("accepts https links and the local development http origin", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_EHUBMARKET_URL", "https://partner.example/path/");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000/");

    const site = await import("@/lib/config/site");

    expect(site.EHUBMARKET_URL).toBe("https://partner.example/path/");
    expect(site.SITE_URL).toBe("http://127.0.0.1:3000");
  });
});
