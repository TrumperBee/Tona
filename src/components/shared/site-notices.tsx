// GCC - site-wide maintenance and announcement notices.
//
// This is a server component: it reads the public-safe settings fields and the
// banner announcements through server helpers, then renders the client banner
// for dismissal. Every read is bounded and failures degrade to "no notice"
// rather than breaking a page.
import { AlertTriangle } from "lucide-react";

import { AnnouncementBanner } from "@/components/shared/announcement-banner";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  getPublicPlatformSettings,
  type PublicPlatformSettings,
} from "@/lib/platform/settings";
import { getBannerAnnouncements } from "@/lib/super-admin/announcements";

interface NoticeData {
  readonly settings: PublicPlatformSettings | null;
  readonly announcements: Awaited<ReturnType<typeof getBannerAnnouncements>>;
}

async function loadNotices(showAnnouncements: boolean): Promise<NoticeData> {
  const [settingsResult, announcementsResult] = await Promise.allSettled([
    getPublicPlatformSettings(),
    showAnnouncements ? getBannerAnnouncements() : Promise.resolve([]),
  ]);

  return {
    settings: settingsResult.status === "fulfilled" ? settingsResult.value : null,
    announcements: announcementsResult.status === "fulfilled" ? announcementsResult.value : [],
  };
}

export interface SiteNoticesProps {
  /**
   * The maintenance banner is always shown. Announcements can be suppressed on
   * the announcement pages themselves to avoid showing the same notice twice.
   */
  readonly showAnnouncements?: boolean;
}

export async function SiteNotices({ showAnnouncements = true }: SiteNoticesProps) {
  const { settings, announcements } = await loadNotices(showAnnouncements);

  if (!settings && announcements.length === 0) {
    return null;
  }

  const maintenanceMessage = settings?.maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE;

  return (
    <>
      {settings?.maintenanceMode ? (
        <div role="status" className="border-b border-gold-400/30 bg-gold-400/10">
          <div className="container flex items-start gap-3 py-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gold-100">Maintenance mode is on</p>
              <p className="mt-0.5 text-xs leading-5 text-gold-200/90">
                {maintenanceMessage} Account changes and new registrations are paused until it is
                switched off.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showAnnouncements && announcements.length > 0 ? (
        <AnnouncementBanner
          announcements={announcements.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            severity: item.severity,
            pinned: item.pinned,
          }))}
        />
      ) : null}
    </>
  );
}
