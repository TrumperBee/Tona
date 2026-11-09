// GCC - public platform announcements.
//
// Only published, unexpired, non-deleted announcements are readable. The page
// is server-rendered and cursor-paginated; it never reads a whole collection.
import { Megaphone } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { getPublicAnnouncements } from "@/lib/super-admin/announcements";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = {
  title: "Announcements",
  description: "Official platform notices from the GCC team.",
};

interface AnnouncementsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  const params = await searchParams;
  const after = firstQueryValue(params.after);
  const result = await getPublicAnnouncements({ after });
  const nextHref =
    result.hasMore && result.lastId
      ? `/announcements?after=${encodeURIComponent(result.lastId)}`
      : null;

  return (
    <div className="container space-y-8 py-12">
      <PageHeader
        eyebrow="Platform notices"
        title="Announcements"
        description="Official updates about GCC availability, competition windows and platform changes. Everything here is published by the GCC team."
      />

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          eyebrow="No announcements"
          title="There are no announcements right now"
          description="Platform notices appear here when the team publishes one. Check the tournaments page for current competitions."
        />
      ) : (
        <>
          <ul className="space-y-5">
            {result.rows.map((item) => (
              <li key={item.id}>
                <Card variant={item.severity === "important" ? "gold" : "default"} className="p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.severity === "important" ? "danger" : "info"}>
                      {item.severity === "important" ? "Important" : "Info"}
                    </Badge>
                    {item.pinned ? <Badge tone="gold">Pinned</Badge> : null}
                    <span className="text-xs text-grey-500">
                      {item.publishedAt ? formatDateTime(item.publishedAt) : "—"}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold uppercase tracking-display text-white">
                    {item.title}
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-grey-300">
                    {item.body}
                  </p>
                  {item.expiresAt ? (
                    <p className="mt-4 text-xs text-grey-500">
                      This notice expires {formatDateTime(item.expiresAt)}.
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>

          <CursorNav
            previousHref={null}
            nextHref={nextHref}
            summary={`Showing ${result.rows.length} announcement${result.rows.length === 1 ? "" : "s"}.`}
            label="Announcement pagination"
          />
        </>
      )}
    </div>
  );
}
