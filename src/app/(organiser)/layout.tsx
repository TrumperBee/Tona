// GCC - organiser route group.
// Requires the organiser role (or Super Admin) before rendering the workspace.
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requirePageRole } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export default async function OrganiserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageRole("organiser", "/organiser");
  const viewer: Viewer = {
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };

  return (
    <WorkspaceShell variant="organiser" viewer={viewer}>
      {children}
    </WorkspaceShell>
  );
}
