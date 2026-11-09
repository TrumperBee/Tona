// GCC - public site shell: accessible skip link, session-aware header and footer.
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteNotices } from "@/components/shared/site-notices";
import { getCurrentUser } from "@/lib/auth/guards";
import type { Viewer } from "@/lib/auth/viewer";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const viewer: Viewer | null = user
    ? { email: user.email, role: user.role, isSuperAdmin: user.isSuperAdmin }
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-electric-500 px-4 py-2 font-semibold text-navy-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <SiteHeader viewer={viewer} />
      <SiteNotices />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
