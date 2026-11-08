// GCC - public site header.
//
// This is a server component so public pages hydrate almost no JavaScript.
// Only the active desktop nav and the mobile menu are client islands.
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLockup } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { Avatar } from "@/components/ui/data-display";
import { buttonStyles } from "@/components/ui/button-styles";
import { viewerDisplayName, viewerHome, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";

interface SiteHeaderProps {
  readonly viewer: Viewer | null;
}

export function SiteHeader({ viewer }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/95">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
        >
          <BrandLockup />
          <span className="sr-only">Home</span>
        </Link>

        <PrimaryNav className="hidden items-center gap-1 lg:flex" />

        <div className="hidden items-center gap-3 lg:flex">
          {viewer ? (
            <>
              <Link
                href={viewerHome(viewer.role)}
                className="flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 transition-colors hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
              >
                <Avatar name={viewerDisplayName(viewer.email)} size="xs" />
                <span className="text-sm font-semibold text-white">
                  {viewerRoleLabel(viewer.role)}
                </span>
              </Link>
              <SignOutButton variant="ghost" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-grey-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
              >
                Sign in
              </Link>
              <Link href="/register" className={buttonStyles({ size: "md" })}>
                Join GCC
              </Link>
            </>
          )}
        </div>

        <MobileNav viewer={viewer} />
      </div>
    </header>
  );
}
