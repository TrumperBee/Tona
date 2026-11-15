"use client";

// GCC - the single signed-in (and signed-out) menu sheet.
//
// One sheet is the only full-page menu anywhere in the product. It lists the
// role-filtered groups from `viewerNavigation` and shows the viewer's avatar,
// gamer tag and role at the top. Organiser and super-admin workspaces use this
// same sheet; their section navigation lives in the tab strip under the top bar,
// never in a second hamburger.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Avatar } from "@/components/ui/data-display";
import { buttonStyles } from "@/components/ui/button-styles";
import { viewerName, viewerRoleLabel, type Viewer } from "@/lib/auth/viewer";
import {
  isNavigationItemCurrent,
  viewerNavigation,
  type NavigationItem,
  type NavigationViewer,
} from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

interface AppMenuSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly viewer: Viewer | null;
}

/** Narrow structural type so the sheet can also be used for the test harness. */
function asNavigationViewer(viewer: Viewer): NavigationViewer {
  return { role: viewer.role, isSuperAdmin: viewer.isSuperAdmin };
}

function MenuLink({
  item,
  pathname,
  onNavigate,
}: {
  readonly item: NavigationItem;
  readonly pathname: string;
  readonly onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = isNavigationItemCurrent(item, pathname);

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
          active
            ? "bg-white/[0.07] text-white"
            : "text-grey-300 hover:bg-white/[0.05] hover:text-white",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-grey-400" />
        <span className="min-w-0 flex-1">{item.label}</span>
      </Link>
    </li>
  );
}

export function AppMenuSheet({ open, onOpenChange, viewer }: AppMenuSheetProps) {
  const pathname = usePathname() ?? "";
  const close = () => onOpenChange(false);

  if (!viewer) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Menu"
        description="Competitions, records and community."
      >
        <nav aria-label="Site menu">
          <ul className="space-y-1">
            {(
              [
                { href: "/tournaments", label: "Tournaments" },
                { href: "/rankings", label: "Rankings" },
                { href: "/hall-of-fame", label: "Hall of Fame" },
                { href: "/archives", label: "Archives" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ] as const
            ).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium text-grey-200 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 grid gap-2 border-t border-white/10 pt-5">
          <Link href="/login" onClick={close} className={buttonStyles({ variant: "secondary" })}>
            Sign in
          </Link>
          <Link href="/register" onClick={close} className={buttonStyles()}>
            Join GCC
          </Link>
        </div>
      </BottomSheet>
    );
  }

  const navigation = viewerNavigation(asNavigationViewer(viewer));
  const name = viewerName(viewer);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      description={viewerRoleLabel(viewer.role)}
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-navy-950/50 p-3">
        <Avatar name={name} src={viewer.avatarUrl ?? null} size="md" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">@{name}</p>
          <p className="truncate text-xs text-grey-400">{viewer.email}</p>
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-eyebrow text-electric-300">
            {viewerRoleLabel(viewer.role)}
          </p>
        </div>
      </div>

      <div className="space-y-5" id="app-menu-sheet">
        {navigation.groups.map((group) => (
          <div key={group.id}>
            <p className="px-3 pb-1.5 text-[12px] font-semibold uppercase tracking-eyebrow text-grey-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <MenuLink key={item.href} item={item} pathname={pathname} onNavigate={close} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <SignOutButton variant="secondary" fullWidth />
      </div>
    </BottomSheet>
  );
}
