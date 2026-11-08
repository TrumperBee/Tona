"use client";

// GCC - mobile menu drawer.
//
// Loaded only after the menu button is pressed. Keeping the drawer content in
// its own module means the navigation links, icons and sign-out control are not
// part of the page's initial hydration.
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Drawer } from "@/components/ui/dialog";
import { viewerHome, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";
import { isNavigationItemActive, publicNavigation } from "@/lib/config/public-navigation";
import { cn } from "@/lib/utils/cn";

interface MobileMenuDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly viewer: Viewer | null;
}

export function MobileMenuDrawer({ open, onOpenChange, viewer }: MobileMenuDrawerProps) {
  const pathname = usePathname();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
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
                    onClick={() => onOpenChange(false)}
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
                onClick={() => onOpenChange(false)}
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
                onClick={() => onOpenChange(false)}
                className={buttonStyles({ variant: "secondary", className: "w-full" })}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => onOpenChange(false)}
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
            onClick={() => onOpenChange(false)}
            className="text-sm text-grey-400 underline-offset-4 hover:text-white hover:underline"
          >
            About GCC
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
