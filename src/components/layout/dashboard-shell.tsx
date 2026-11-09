"use client";

// GCC - participant dashboard shell.
// Desktop sidebar, mobile bottom navigation and a full mobile drawer.
import { Bell, Menu, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLockup, BrandMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/data-display";
import { Drawer } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import {
  dashboardNavigation,
  isNavigationItemActive,
  type NavigationItem,
} from "@/lib/config/navigation";
import { viewerName, type Viewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/utils/cn";

interface DashboardShellProps {
  readonly viewer: Viewer;
  readonly notices?: React.ReactNode;
  readonly children: React.ReactNode;
}

function navClasses(active: boolean): string {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
    active
      ? "bg-electric-500/10 text-white shadow-[inset_2px_0_0_0_#2E9BFF]"
      : "text-grey-300 hover:bg-white/[0.05] hover:text-white",
  );
}

function NavigationList({
  items,
  pathname,
  onNavigate,
}: {
  readonly items: readonly NavigationItem[];
  readonly pathname: string;
  readonly onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isNavigationItemActive(pathname, item.href, item.exact);
        const Icon = item.icon;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
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

export function DashboardShell({ viewer, notices, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayName = viewerName(viewer);
  const activeItem = dashboardNavigation.find((item) =>
    isNavigationItemActive(pathname, item.href, item.exact),
  );

  const primaryMobile = dashboardNavigation.slice(0, 4);

  return (
    <div className="min-h-dvh bg-navy-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-navy-900/60 lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link
            href="/"
            aria-label="Global Champions Circuit home"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandLockup compact />
          </Link>
        </div>

        <div className="px-5 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-electric-300">
            Player dashboard
          </p>
        </div>

        <nav aria-label="Dashboard" className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
          <NavigationList items={dashboardNavigation} pathname={pathname} />
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={displayName} src={viewer.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-grey-500">{viewer.email}</p>
            </div>
          </div>
          <SignOutButton variant="secondary" fullWidth />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-navy-950/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Global Champions Circuit home"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 lg:hidden"
            >
              <BrandMark className="h-8 w-8" />
            </Link>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500 sm:block">
                Player dashboard
              </p>
              <p className="truncate font-display text-lg font-semibold uppercase tracking-display text-white">
                {activeItem?.label ?? "Dashboard"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/dashboard/notifications"
              aria-label="Notifications"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-grey-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              <Bell aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard/profile"
              aria-label="Your profile"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              <Avatar name={displayName} src={viewer.avatarUrl} size="sm" />
            </Link>
            <IconButton
              label="Open dashboard menu"
              variant="outline"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </IconButton>
          </div>
        </header>

        {notices}

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <nav
        aria-label="Dashboard mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/95 backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {primaryMobile.map((item) => {
            const active = isNavigationItemActive(pathname, item.href, item.exact);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors",
                    active ? "text-electric-300" : "text-grey-400 hover:text-white",
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold text-grey-400 transition-colors hover:text-white"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="left"
        title="Player dashboard"
        description="Your competitions and account."
        className="lg:hidden"
      >
        <nav aria-label="Dashboard mobile">
          <NavigationList
            items={dashboardNavigation}
            pathname={pathname}
            onNavigate={() => setDrawerOpen(false)}
          />
        </nav>

        <div className="mt-6 border-t border-white/10 pt-5">
          {viewer.role !== "user" ? (
            <Link
              href="/organiser"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-gold-200 hover:bg-white/[0.05]"
            >
              <Shield aria-hidden="true" className="h-4 w-4" />
              Organiser workspace
            </Link>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={displayName} src={viewer.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-grey-500">{viewer.email}</p>
            </div>
          </div>
          <div className="mt-4">
            <SignOutButton variant="secondary" fullWidth />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
