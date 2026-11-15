"use client";

// GCC - participant dashboard shell.
//
// Desktop keeps the section sidebar. On a phone the shared app chrome provides
// the slim top bar, the single menu sheet and the four bottom tabs; there is no
// second hamburger and no second full-page menu.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppMobileChrome } from "@/components/layout/app-mobile-chrome";
import { BrandLockup } from "@/components/brand/logo";
import { DesktopUserMenu } from "@/components/layout/desktop-user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageContainer } from "@/components/ui/page-container";
import { Avatar } from "@/components/ui/data-display";
import {
  dashboardNavigation,
  isNavigationItemCurrent,
  type NavigationItem,
} from "@/lib/config/navigation";
import type { NotificationBellData } from "@/lib/notifications/types";
import { viewerName, type Viewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/utils/cn";

interface DashboardShellProps {
  readonly viewer: Viewer;
  readonly notificationBell: NotificationBellData;
  readonly notices?: React.ReactNode;
  readonly children: React.ReactNode;
}

function navClasses(active: boolean): string {
  return cn(
    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
    active
      ? "bg-electric-500/10 text-white shadow-[inset_2px_0_0_0_#2E9BFF]"
      : "text-grey-300 hover:bg-white/[0.05] hover:text-white",
  );
}

function NavigationList({
  items,
  pathname,
}: {
  readonly items: readonly NavigationItem[];
  readonly pathname: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isNavigationItemCurrent(item, pathname);
        const Icon = item.icon;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={navClasses(active)}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardShell({
  viewer,
  notificationBell,
  notices,
  children,
}: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const displayName = viewerName(viewer);
  const activeItem = dashboardNavigation.find((item) => isNavigationItemCurrent(item, pathname));

  return (
    <div className="min-h-dvh bg-navy-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-navy-900/60 lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link
            href="/"
            aria-label="GCC home"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandLockup compact />
          </Link>
        </div>

        <div className="px-5 pt-5">
          <p className="text-[12px] font-semibold uppercase tracking-eyebrow text-electric-300">
            Player dashboard
          </p>
        </div>

        <nav aria-label="Dashboard" className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
          <NavigationList items={dashboardNavigation} pathname={pathname} />
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={displayName} src={viewer.avatarUrl ?? null} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-grey-500">{viewer.email}</p>
            </div>
          </div>
          <SignOutButton variant="secondary" fullWidth />
        </div>
      </aside>

      <div className="lg:pl-64">
        <AppMobileChrome
          viewer={viewer}
          notificationBell={notificationBell}
          sectionLabel="Player dashboard"
        />

        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-white/10 bg-navy-950/85 px-6 backdrop-blur-xl lg:flex">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-eyebrow text-grey-500">
              Player dashboard
            </p>
            <p className="truncate font-display text-lg font-semibold uppercase tracking-display text-white">
              {activeItem?.label ?? "Dashboard"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell data={notificationBell} />
            <DesktopUserMenu viewer={viewer} />
          </div>
        </header>

        {notices}

        <PageContainer
          as="main"
          className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 lg:pb-12"
        >
          {children}
        </PageContainer>
      </div>
    </div>
  );
}
