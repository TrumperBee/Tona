// GCC - public site header.
//
// This is a server component so public pages hydrate almost no JavaScript.
// Phones get the shared app chrome: one slim signed-in bar (logo, real unread
// bell, avatar menu and bottom tabs) or the signed-out bar with "Sign in" and
// the same menu sheet. Desktop keeps the full navigation and a user dropdown.
import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";
import { AppMobileChrome } from "@/components/layout/app-mobile-chrome";
import { DesktopUserMenu } from "@/components/layout/desktop-user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { PublicMobileBar } from "@/components/layout/public-mobile-bar";
import { buttonStyles } from "@/components/ui/button-styles";
import type { Viewer } from "@/lib/auth/viewer";
import type { NotificationBellData } from "@/lib/notifications/types";

interface SiteHeaderProps {
  readonly viewer: Viewer | null;
  readonly notificationBell: NotificationBellData | null;
}

export function SiteHeader({ viewer, notificationBell }: SiteHeaderProps) {
  return (
    <>
      {viewer && notificationBell ? (
        <AppMobileChrome viewer={viewer} notificationBell={notificationBell} />
      ) : (
        <PublicMobileBar />
      )}

      <header className="sticky top-0 z-40 hidden border-b border-white/10 bg-navy-950/95 lg:block">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <BrandLockup />
            <span className="sr-only">Home</span>
          </Link>

          <PrimaryNav className="flex items-center gap-1" />

          <div className="flex items-center gap-2">
            {viewer ? (
              <>
                {notificationBell ? <NotificationBell data={notificationBell} /> : null}
                <DesktopUserMenu viewer={viewer} />
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
        </div>
      </header>
    </>
  );
}
