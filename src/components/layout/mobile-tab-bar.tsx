"use client";

// GCC - persistent signed-in mobile tab bar.
//
// Four tabs: Home, Tournaments, My matches and Profile. The bar sits above the
// iOS home indicator (safe-area inset) and hides itself while the on-screen
// keyboard is open, using `visualViewport`, so it never covers a focused input.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeMobileTab, mobileTabNavigation } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

/** The keyboard is treated as open when it shrinks the visual viewport a lot. */
const KEYBOARD_THRESHOLD = 120;

export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const active = activeMobileTab(pathname);

  useEffect(() => {
    const viewport: VisualViewport | null = window.visualViewport;

    if (!viewport) {
      return;
    }

    const view = viewport;

    function update(): void {
      setKeyboardOpen(window.innerHeight - view.height > KEYBOARD_THRESHOLD);
    }

    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);

    return () => {
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <nav
      aria-label="Primary mobile"
      aria-hidden={keyboardOpen ? true : undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/95 lg:hidden",
        "transition-transform duration-200",
        keyboardOpen && "pointer-events-none translate-y-full",
      )}
    >
      <ul className="grid grid-cols-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mobileTabNavigation.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                tabIndex={keyboardOpen ? -1 : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-400",
                  isActive ? "text-electric-300" : "text-grey-400 hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
