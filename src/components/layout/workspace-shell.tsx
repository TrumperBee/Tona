"use client";

// GCC - organiser and Super Admin workspace shell.
//
// The two variants share mechanics but keep distinct accents, labels and
// navigation so an operator always knows which workspace they are in. On a
// phone the shared app chrome owns the top bar, the single menu and the bottom
// tabs; the workspace sections become a scrollable tab strip under the top bar.
import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLockup } from "@/components/brand/logo";
import { AppMobileChrome } from "@/components/layout/app-mobile-chrome";
import { DesktopUserMenu } from "@/components/layout/desktop-user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PageContainer } from "@/components/ui/page-container";
import { Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data-display";
import {
  isNavigationItemCurrent,
  organiserNavigation,
  organiserTournamentNavigation,
  organiserTournamentWorkspace,
  superAdminNavigation,
  tournamentIdFromOrganiserPath,
  type NavigationItem,
} from "@/lib/config/navigation";
import type { NotificationBellData } from "@/lib/notifications/types";
import { viewerDisplayName, type Viewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/utils/cn";

export type WorkspaceVariant = "organiser" | "super-admin";

interface WorkspaceShellProps {
  readonly variant: WorkspaceVariant;
  readonly viewer: Viewer;
  readonly notificationBell: NotificationBellData;
  readonly notices?: React.ReactNode;
  readonly children: React.ReactNode;
}

function itemClasses(active: boolean, muted = false): string {
  return cn(
    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
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

export function WorkspaceShell({
  variant,
  viewer,
  notificationBell,
  notices,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname() ?? "";
  const isOrganiser = variant === "organiser";
  const displayName = viewerDisplayName(viewer.email);

  const primaryNavigation = isOrganiser ? organiserNavigation : superAdminNavigation;
  const tournamentId = isOrganiser ? tournamentIdFromOrganiserPath(pathname) : null;
  const tournamentItems = tournamentId ? organiserTournamentNavigation(tournamentId) : [];
  const activeTournamentItem = tournamentItems.find((item) =>
    isNavigationItemCurrent(item, pathname),
  );
  const activePrimaryItem = primaryNavigation.find((item) =>
    isNavigationItemCurrent(item, pathname),
  );

  const title =
    activeTournamentItem?.label ??
    activePrimaryItem?.label ??
    (isOrganiser ? "Organiser" : "Super Admin");

  const workspaceLabel = isOrganiser ? "Organiser workspace" : "Super Admin console";
  const accentText = isOrganiser ? "text-gold-300" : "text-electric-300";
  const accentBorder = isOrganiser ? "border-t-gold-400/70" : "border-t-electric-400/70";
  const sidebarBackground = isOrganiser
    ? "bg-gradient-to-b from-navy-900/80 via-navy-950 to-navy-950"
    : "bg-gradient-to-b from-electric-950/40 via-navy-950 to-navy-950";

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
            aria-label="GCC home"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandLockup compact />
          </Link>
        </div>

        <div className="px-5 pt-5">
          <div className="flex items-center gap-2">
            <p className={cn("text-[12px] font-semibold uppercase tracking-eyebrow", accentText)}>
              {workspaceLabel}
            </p>
            <Badge tone={isOrganiser ? "gold" : "danger"}>
              {isOrganiser ? "Organiser" : "Restricted"}
            </Badge>
          </div>
        </div>

        <nav aria-label={workspaceLabel} className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
          <NavigationLinks items={primaryNavigation} pathname={pathname} />

          {isOrganiser ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-2 px-3">
                <p className="text-[12px] font-semibold uppercase tracking-eyebrow text-grey-500">
                  Tournament workspace
                </p>
                {!tournamentId ? (
                  <Lock aria-hidden="true" className="h-3 w-3 text-grey-600" />
                ) : null}
              </div>
              {tournamentId ? (
                <ul className="mt-2 space-y-1">
                  {tournamentItems.map((item) => {
                    const active = isNavigationItemCurrent(item, pathname);
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
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
                  <p className="mt-2 px-3 text-[12px] leading-5 text-grey-600">
                    Open one of your tournaments to use these tools.
                  </p>
                </div>
              )}
            </div>
          ) : null}
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
            className="mt-3 flex min-h-11 items-center justify-center gap-1 text-xs text-grey-500 transition-colors hover:text-grey-300"
          >
            Player dashboard
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>
      </aside>

      <div className="lg:pl-72">
        <AppMobileChrome
          viewer={viewer}
          notificationBell={notificationBell}
          sectionItems={primaryNavigation}
          sectionLabel={workspaceLabel}
          sectionAccent={isOrganiser ? "gold" : "electric"}
        />

        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-white/10 bg-navy-950/85 px-6 backdrop-blur-xl lg:flex">
          <div className="min-w-0">
            <p className={cn("text-[12px] font-semibold uppercase tracking-eyebrow", accentText)}>
              {workspaceLabel}
            </p>
            <p className="truncate font-display text-lg font-semibold uppercase tracking-display text-white">
              {title}
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
          width="wide"
          className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 lg:pb-12"
        >
          {children}
        </PageContainer>
      </div>
    </div>
  );
}
