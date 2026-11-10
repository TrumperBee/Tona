// GCC - notification inbox.
//
// Newest first, cursor-paginated, owner-only. Unread items are styled and can be
// marked read individually or all at once through the server route.
import { Bell } from "lucide-react";

import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { EmptyState } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { listNotifications } from "@/lib/notifications";
import { firstQueryValue } from "@/lib/super-admin/query";

export const metadata = { title: "Notifications" };

interface NotificationsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function listHref(cursor: {
  readonly after?: string | null;
  readonly before?: string | null;
}): string {
  const params = new URLSearchParams();

  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/dashboard/notifications?${query}` : "/dashboard/notifications";
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await requirePageSignedIn("/dashboard/notifications");
  const params = await searchParams;
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const result = await listNotifications(user.userId, { after, before });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Player dashboard"
        title="Notifications"
        description="Competition updates, result notices and account messages created by real platform events."
      />

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          eyebrow="Inbox"
          title="No notifications yet"
          description="Messages appear only when something happens on your account or a competition you are part of. Nothing is seeded for display."
        />
      ) : (
        <>
          <NotificationList
            items={result.rows.map((row) => ({
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              link: row.link,
              read: row.read,
              createdAt: row.createdAt ? row.createdAt.toISOString() : null,
            }))}
            unread={result.unread}
          />
          <CursorNav
            previousHref={
              (after || before) && result.firstId ? listHref({ before: result.firstId }) : null
            }
            nextHref={result.hasMore && result.lastId ? listHref({ after: result.lastId }) : null}
            summary={`Showing ${result.rows.length} of ${result.total} notifications.`}
          />
        </>
      )}
    </div>
  );
}
