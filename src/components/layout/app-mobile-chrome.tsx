"use client";

// GCC - signed-in mobile chrome.
//
// One slim top bar (logo, real unread bell, avatar button) and one bottom tab
// bar, used by the public site, the dashboard, the organiser workspace and the
// super-admin console. The avatar button opens the single menu sheet. Organiser
// and super-admin section navigation is passed in as a tab strip, not a second
// hamburger.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { BrandMark } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Avatar } from "@/components/ui/data-display";
import { TabStrip } from "@/components/ui/tab-strip";
import { viewerName, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";
import type { NavigationItem } from "@/lib/config/navigation";
import type { NotificationBellData } from "@/lib/notifications/types";
import { cn } from "@/lib/utils/cn";

// Deferred until the first open: the sheet carries the full navigation icon set
// and the dialog primitives, which the first screen does not need.
const AppMenuSheet = dynamic(
  () => import("@/components/layout/app-menu-sheet").then((module) => module.AppMenuSheet),
  { ssr: false },
);

export interface AppMobileChromeProps {
  readonly viewer: Viewer;
  readonly notificationBell: NotificationBellData;
  /** Section links shown as a scrollable strip under the top bar. */
  readonly sectionItems?: readonly NavigationItem[];
  readonly sectionLabel?: string;
  readonly sectionAccent?: "electric" | "gold";
  readonly showTabs?: boolean;
}

export function AppMobileChrome({
  viewer,
  notificationBell,
  sectionItems,
  sectionLabel,
  sectionAccent = "electric",
  showTabs = true,
}: AppMobileChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const name = viewerName(viewer);

  function openMenu(): void {
    setMenuMounted(true);
    setMenuOpen(true);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/95 pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex min-h-14 items-center gap-2 px-3 py-1.5">
          <Link
            href="/dashboard"
            aria-label="GCC home"
            className="flex min-h-11 items-center gap-2 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-sm font-semibold uppercase tracking-display text-white">
              GCC
            </span>
          </Link>

          <span
            className={cn(
              "ml-auto truncate text-xs font-semibold uppercase tracking-eyebrow",
              sectionAccent === "gold" ? "text-gold-300" : "text-electric-300",
            )}
          >
            {sectionLabel ?? viewerRoleLabel(viewer.role)}
          </span>

          <NotificationBell data={notificationBell} />

          <button
            type="button"
            onClick={openMenu}
            aria-label={`Open menu for ${name}`}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <Avatar name={name} src={viewer.avatarUrl ?? null} size="sm" />
          </button>
        </div>

        {sectionItems && sectionItems.length > 0 ? (
          <div className="px-4 pb-2">
            <TabStrip
              items={sectionItems}
              ariaLabel={sectionLabel ?? "Section navigation"}
              accent={sectionAccent}
            />
          </div>
        ) : null}
      </header>

      {menuMounted ? (
        <AppMenuSheet open={menuOpen} onOpenChange={setMenuOpen} viewer={viewer} />
      ) : null}

      {showTabs ? <MobileTabBar /> : null}
    </>
  );
}
