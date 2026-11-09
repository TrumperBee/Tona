// GCC - participant dashboard route group.
// Unauthenticated visitors are redirected before the shell renders. Email
// verification is NOT required here: unverified players may still view their
// own profile, but tournament entry uses requireVerifiedUser on the server.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SiteNotices } from "@/components/shared/site-notices";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/viewer";
import { getOwnProfile } from "@/lib/profile/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageSignedIn("/dashboard");
  const profile = await getOwnProfile(user.userId);
  const viewer: Viewer = {
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    emailVerified: user.emailVerified,
    gamerTag: profile?.user.gamerTag,
    fullName: profile?.user.fullName,
    avatarUrl: profile?.user.avatarUrl ?? null,
  };

  return (
    <DashboardShell viewer={viewer} notices={<SiteNotices />}>
      {children}
    </DashboardShell>
  );
}
