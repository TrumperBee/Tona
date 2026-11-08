// GCC — build configuration and platform security headers.
// Runtime environment is validated in src/lib/config/env.ts and env.server.ts.
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep the repository tree exactly as specified: no auto-generated AGENTS.md.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Fails a production build early when the canonical site URL is missing or
 * invalid. Browser code validates lazily through getPublicEnv(); this check
 * makes the build itself the clear failure point.
 */
function assertProductionSiteUrl(): void {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is required for a production build. " +
        "Set it to the canonical deployment URL, for example https://tona-olive.vercel.app.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL is not a valid absolute URL: "${raw}". ` +
        "Use an absolute http(s) URL without a trailing slash.",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`NEXT_PUBLIC_SITE_URL must use http or https, received "${parsed.protocol}".`);
  }
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    assertProductionSiteUrl();
  }

  return nextConfig;
}
