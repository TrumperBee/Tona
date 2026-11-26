// GCC — build configuration and platform security headers.
// Runtime environment is validated in src/lib/config/env.ts and env.server.ts.
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "interest-cohort=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=(self)",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Preload-ready. The domain should be submitted to the HSTS preload list only
  // after every subdomain is HTTPS-only.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: permissionsPolicy,
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
