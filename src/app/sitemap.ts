// GCC - sitemap.
// Public routes plus every published tournament. Private shells are excluded
// here and disallowed in robots.ts.
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/config/site";
import { getPublicTournaments } from "@/lib/data/public-tournaments";

export const revalidate = 3600;

const publicRoutes: ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/tournaments", changeFrequency: "daily", priority: 0.9 },
  { path: "/rankings", changeFrequency: "daily", priority: 0.8 },
  { path: "/hall-of-fame", changeFrequency: "weekly", priority: 0.7 },
  { path: "/archives", changeFrequency: "weekly", priority: 0.7 },
  { path: "/players", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const tournaments = await getPublicTournaments(500);

  return [
    ...publicRoutes.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...tournaments.map((tournament) => ({
      url: `${SITE_URL}/tournaments/${tournament.slug}`,
      lastModified: tournament.startsAt ? new Date(tournament.startsAt) : lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
