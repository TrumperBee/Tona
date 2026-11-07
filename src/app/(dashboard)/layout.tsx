// GCC - participant dashboard route group.
// The Phase 2 session guard runs before the shell is rendered.
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageUser("/dashboard");
  const viewer: Viewer = {
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };

  return <DashboardShell viewer={viewer}>{children}</DashboardShell>;
}
