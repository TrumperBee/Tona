// GCC — Firebase configuration files.
// Runtime environment is validated in src/lib/config/env.ts and env.server.ts.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep the repository tree exactly as specified: no auto-generated AGENTS.md.
  agentRules: false,
};

export default nextConfig;
