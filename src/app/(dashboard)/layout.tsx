// GCC - participant dashboard route group.
// Unauthenticated visitors are redirected before the shell renders. There is no
// email-verification gate: an active account may view its own profile and enter
// tournaments.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SiteNotices } from "@/components/shared/site-notices";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/viewer";
import { getNotificationBell } from "@/lib/notifications/bell";
import { getOwnProfile } from "@/lib/profile/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageSignedIn("/dashboard");
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
    <DashboardShell viewer={viewer} notificationBell={notificationBell} notices={<SiteNotices />}>
      {children}
    </DashboardShell>
  );
}
