// GCC - crawler policy.
// Public pages and published tournaments are indexable. Authenticated
// workspaces, API routes, account screens and the internal design-system
// showcase are not.
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/config/site";

const disallowed = [
  "/api/",
  "/dashboard",
  "/organiser",
  "/super-admin",
  "/design-system",
  "/login",
  "/register",
  "/forgot-password",
  "/auth/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowed,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
