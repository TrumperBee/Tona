"use client";

// GCC - public site header.
//
// Navigation is real: every link resolves to a route in the application tree.
// Auth controls reflect the verified server session passed from the layout.
import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLockup } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/data-display";
import { Drawer } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { buttonStyles } from "@/components/ui/button-styles";
import { publicNavigation, isNavigationItemActive } from "@/lib/config/navigation";
import { viewerDisplayName, viewerHome, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/utils/cn";

interface SiteHeaderProps {
  readonly viewer: Viewer | null;
}

export function SiteHeader({ viewer }: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
        >
          <BrandLockup />
          <span className="sr-only">Home</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {publicNavigation.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-grey-300 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

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

        <div className="flex items-center gap-1.5 lg:hidden">
          {viewer ? (
            <Link
              href={viewerHome(viewer.role)}
              aria-label={`Go to ${viewerRoleLabel(viewer.role)}`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              <Avatar name={viewerDisplayName(viewer.email)} size="sm" />
            </Link>
          ) : null}
          <IconButton
            label={menuOpen ? "Close menu" : "Open menu"}
            variant="outline"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="right"
        title="Menu"
        description="Competitions, records and community."
        className="lg:hidden"
      >
        <div id="public-mobile-menu">
          <nav aria-label="Primary mobile">
            <ul className="space-y-1">
              {publicNavigation.map((item) => {
                const active = isNavigationItemActive(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-3 text-base font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-grey-300 hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {item.label}
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-grey-500" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
            {viewer ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                  Signed in as {viewer.email}
                </p>
                <Link
                  href={viewerHome(viewer.role)}
                  onClick={() => setMenuOpen(false)}
                  className={buttonStyles({ className: "w-full" })}
                >
                  Go to {viewerRoleLabel(viewer.role)}
                </Link>
                <SignOutButton variant="secondary" fullWidth />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className={buttonStyles({ variant: "secondary", className: "w-full" })}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className={buttonStyles({ className: "w-full" })}
                >
                  Join GCC
                </Link>
              </>
            )}
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-grey-400 underline-offset-4 hover:text-white hover:underline"
            >
              About GCC
            </Link>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
