// GCC - public site shell: accessible skip link, session-aware header and footer.
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteNotices } from "@/components/shared/site-notices";
import { getCurrentUser } from "@/lib/auth/guards";
import type { Viewer } from "@/lib/auth/viewer";
import { getNotificationBell } from "@/lib/notifications/bell";
import { getOwnProfile } from "@/lib/profile/server";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  // Resolve the notices before the shell is sent. A streamed notice would be
  // inserted above the page content after first paint and push the whole page
  // down (a real layout shift on every route).
  const notices = await SiteNotices({});

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-md bg-electric-500 px-4 py-2 font-semibold text-navy-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to main content
        </a>
        <SiteHeader viewer={null} notificationBell={null} />
        {notices}
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    );
  }

  // A signed-in visitor still gets the full app chrome: the real unread count
  // and avatar come from the same server helpers the dashboard uses, so the
  // public header can never show a made-up badge.
  const [profile, notificationBell] = await Promise.all([
    getOwnProfile(user.userId),
    getNotificationBell(user.userId),
  ]);
  const viewer: Viewer = {
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    gamerTag: profile?.user.gamerTag,
    fullName: profile?.user.fullName,
    avatarUrl: profile?.user.avatarUrl ?? null,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-electric-500 px-4 py-2 font-semibold text-navy-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <SiteHeader viewer={viewer} notificationBell={notificationBell} />
      {notices}
      <main
        id="main-content"
        className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
