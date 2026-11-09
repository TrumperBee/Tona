// GCC - platform announcement management.
import { Megaphone } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementManager } from "@/components/super-admin/announcement-manager";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { listAnnouncements } from "@/lib/super-admin/announcements";
import { firstQueryValue } from "@/lib/super-admin/query";

export const metadata = { title: "Announcements" };

interface AnnouncementsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pageHref(cursor: { readonly after?: string | null; readonly before?: string | null }) {
  const params = new URLSearchParams();

  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/super-admin/announcements?${query}` : "/super-admin/announcements";
}

export default async function AnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  const params = await searchParams;
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const result = await listAnnouncements({ after, before });

  const items = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    pinned: row.pinned,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Platform announcements"
        description="Platform-wide notices shown in the site banner and on the public announcements page. Everything is written by the server and audited."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Announcements" }]}
        actions={
          <Link
            href="/announcements"
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            <Megaphone aria-hidden="true" className="h-4 w-4" />
            View public page
          </Link>
        }
      />

      <AnnouncementManager items={items} />

      <CursorNav
        previousHref={
          (after || before) && result.firstId ? pageHref({ before: result.firstId }) : null
        }
        nextHref={result.hasMore && result.lastId ? pageHref({ after: result.lastId }) : null}
        summary={`Showing ${result.rows.length} of ${result.total} announcements.`}
        label="Announcement pagination"
      />
    </div>
  );
}
