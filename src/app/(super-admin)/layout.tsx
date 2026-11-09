// GCC - Super Admin route group.
// Requires the configured Super Admin account before rendering any chrome.
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { SiteNotices } from "@/components/shared/site-notices";
import { requirePageSuperAdmin } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageSuperAdmin("/super-admin");
  const viewer: Viewer = {
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };

  return (
    <WorkspaceShell variant="super-admin" viewer={viewer} notices={<SiteNotices />}>
      {children}
    </WorkspaceShell>
  );
}
