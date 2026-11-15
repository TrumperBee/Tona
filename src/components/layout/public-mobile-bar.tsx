"use client";

// GCC - signed-out mobile top bar.
//
// Visitors who are not signed in still get a slim bar with the logo, a clear
// "Sign in" action and the one menu sheet. There is no hamburger on the right
// that opens a second, different menu: the sheet is the same component the
// signed-in chrome uses, with the visitor variant.
import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button-styles";
import { IconButton } from "@/components/ui/icon-button";

// The sheet pulls in the icon set and the dialog primitives. Visitors who never
// open the menu never download them, which keeps the public pages light.
const AppMenuSheet = dynamic(
  () => import("@/components/layout/app-menu-sheet").then((module) => module.AppMenuSheet),
  { ssr: false },
);

export function PublicMobileBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  function openMenu(): void {
    setMounted(true);
    setMenuOpen(true);
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/95 lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex min-h-14 items-center gap-3 px-4 py-1.5">
          <Link
            href="/"
            aria-label="GCC home"
            className="flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-sm font-semibold uppercase tracking-display text-white">
              GCC
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className={buttonStyles({ size: "sm" })}>
              Sign in
            </Link>
            <IconButton
              label={menuOpen ? "Close menu" : "Open menu"}
              variant="outline"
              onClick={openMenu}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </header>

      {mounted ? <AppMenuSheet open={menuOpen} onOpenChange={setMenuOpen} viewer={null} /> : null}
    </>
  );
}
