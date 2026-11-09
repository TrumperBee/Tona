"use client";

// GCC - organiser and Super Admin workspace shell.
//
// The two variants share mechanics but have distinct accents, labels and
// navigation so an operator always knows which workspace they are in.
import { Bell, ChevronRight, Lock, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLockup, BrandMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data-display";
import { Drawer } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import {
  isNavigationItemActive,
  organiserNavigation,
  organiserTournamentNavigation,
  organiserTournamentWorkspace,
  superAdminNavigation,
  tournamentIdFromOrganiserPath,
  type NavigationItem,
} from "@/lib/config/navigation";
import { viewerDisplayName, type Viewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/utils/cn";

export type WorkspaceVariant = "organiser" | "super-admin";

interface WorkspaceShellProps {
  readonly variant: WorkspaceVariant;
  readonly viewer: Viewer;
  readonly notices?: React.ReactNode;
  readonly children: React.ReactNode;
}

function itemClasses(active: boolean, muted = false): string {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
    muted && "cursor-default text-grey-500",
    !muted &&
      (active
        ? "bg-white/[0.07] text-white shadow-[inset_2px_0_0_0_currentColor]"
        : "text-grey-300 hover:bg-white/[0.05] hover:text-white"),
  );
}

function NavigationLinks({
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
              className={itemClasses(active)}
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

export function WorkspaceShell({ variant, viewer, notices, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isOrganiser = variant === "organiser";
  const displayName = viewerDisplayName(viewer.email);

  const primaryNavigation = isOrganiser ? organiserNavigation : superAdminNavigation;
  const tournamentId = isOrganiser ? tournamentIdFromOrganiserPath(pathname) : null;
  const tournamentItems = tournamentId ? organiserTournamentNavigation(tournamentId) : [];
  const activeTournamentItem = tournamentItems.find((item) =>
    isNavigationItemActive(pathname, item.href, item.exact),
  );
  const activePrimaryItem = primaryNavigation.find((item) =>
    isNavigationItemActive(pathname, item.href, item.exact),
  );

  const title =
    activeTournamentItem?.label ??
    activePrimaryItem?.label ??
    (isOrganiser ? "Organiser" : "Super Admin");

  const mobileItems = isOrganiser
    ? organiserNavigation.slice(0, 3)
    : superAdminNavigation.slice(0, 3);

  const workspaceLabel = isOrganiser ? "Organiser workspace" : "Super Admin console";
  const accentText = isOrganiser ? "text-gold-300" : "text-electric-300";
  const accentBorder = isOrganiser ? "border-t-gold-400/70" : "border-t-electric-400/70";
  const sidebarBackground = isOrganiser
    ? "bg-gradient-to-b from-navy-900/80 via-navy-950 to-navy-950"
    : "bg-gradient-to-b from-electric-950/40 via-navy-950 to-navy-950";

  function renderSidebarNavigation(onNavigate?: () => void) {
    return (
      <>
        <NavigationLinks items={primaryNavigation} pathname={pathname} onNavigate={onNavigate} />

        {isOrganiser ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                Tournament workspace
              </p>
              {!tournamentId ? <Lock aria-hidden="true" className="h-3 w-3 text-grey-600" /> : null}
            </div>
            {tournamentId ? (
              <ul className="mt-2 space-y-1">
                {tournamentItems.map((item) => {
                  const active = isNavigationItemActive(pathname, item.href, item.exact);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={itemClasses(active)}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-2">
                <ul className="space-y-0.5">
                  {organiserTournamentWorkspace.map((item) => {
                    const Icon = item.icon;

                    return (
                      <li
                        key={item.label}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-grey-600"
                      >
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 px-3 text-[11px] leading-5 text-grey-600">
                  Open one of your tournaments to use these tools.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-navy-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-t-2 border-white/10 lg:flex",
          accentBorder,
          sidebarBackground,
        )}
      >
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
          <div className="flex items-center gap-2">
            <p className={cn("text-[10px] font-semibold uppercase tracking-eyebrow", accentText)}>
              {workspaceLabel}
            </p>
            <Badge tone={isOrganiser ? "gold" : "danger"}>
              {isOrganiser ? "Organiser" : "Restricted"}
            </Badge>
          </div>
        </div>

        <nav aria-label={workspaceLabel} className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
          {renderSidebarNavigation()}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-grey-500">{viewer.email}</p>
            </div>
          </div>
          <SignOutButton variant="secondary" fullWidth />
          <Link
            href="/dashboard"
            className="mt-3 flex items-center justify-center gap-1 text-xs text-grey-500 transition-colors hover:text-grey-300"
          >
            Player dashboard
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>
      </aside>

      <div className="lg:pl-72">
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
              <p
                className={cn(
                  "hidden text-[10px] font-semibold uppercase tracking-eyebrow sm:block",
                  accentText,
                )}
              >
                {workspaceLabel}
              </p>
              <p className="truncate font-display text-lg font-semibold uppercase tracking-display text-white">
                {title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isOrganiser ? (
              <Link
                href="/super-admin/announcements"
                aria-label="Platform announcements"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-grey-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
              >
                <Bell aria-hidden="true" className="h-5 w-5" />
              </Link>
            ) : null}
            <Avatar name={displayName} size="sm" />
            <IconButton
              label={`Open ${workspaceLabel} menu`}
              variant="outline"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </IconButton>
          </div>
        </header>

        {notices}

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <nav
        aria-label={`${workspaceLabel} mobile navigation`}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/95 backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {mobileItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href, item.exact);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors",
                    active ? accentText : "text-grey-400 hover:text-white",
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
        title={workspaceLabel}
        description={isOrganiser ? "Run and review your competitions." : "Platform administration."}
        className="lg:hidden"
      >
        <nav aria-label={`${workspaceLabel} mobile`}>
          {renderSidebarNavigation(() => setDrawerOpen(false))}
        </nav>

        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="sm" />
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
