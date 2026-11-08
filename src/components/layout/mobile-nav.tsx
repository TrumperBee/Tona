"use client";

// GCC - mobile menu trigger.
//
// This is the smallest possible client island: an avatar link and a menu
// button. The drawer itself is a separate module loaded on demand, so visitors
// who never open the menu never download or hydrate it.
import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { IconButton } from "@/components/ui/icon-button";
import { viewerDisplayName, viewerHome, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";

const MobileMenuDrawer = dynamic(
  () => import("@/components/layout/mobile-menu-drawer").then((module) => module.MobileMenuDrawer),
  { ssr: false },
);

interface MobileNavProps {
  readonly viewer: Viewer | null;
}

export function MobileNav({ viewer }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
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

      {menuOpen ? (
        <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} viewer={viewer} />
      ) : null}
    </div>
  );
}
