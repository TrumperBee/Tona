// GCC - navigation model.
//
// Every item here resolves to a route that exists in the application tree.
// The shells render from this file so navigation can never drift from routing.
import {
  BarChart3,
  Bell,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Compass,
  Flag,
  Home,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  ListOrdered,
  Mail,
  Megaphone,
  Pencil,
  Plus,
  ScrollText,
  Settings,
  Shield,
  Swords,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/domain";

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
  readonly icon: LucideIcon;
  /** Match only the exact path rather than a nested prefix. */
  readonly exact?: boolean;
  /** Extra path prefixes that should also highlight this item. */
  readonly activePrefixes?: readonly string[];
}

export { isNavigationItemActive, publicNavigation } from "@/lib/config/public-navigation";

export const dashboardNavigation: readonly NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Your competitions and next actions",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/tournaments",
    label: "Tournaments",
    description: "Competitions you have entered",
    icon: Trophy,
  },
  {
    href: "/dashboard/fixtures",
    label: "Fixtures",
    description: "Matches, deadlines and results",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    description: "Competition and account updates",
    icon: Bell,
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    description: "Identity, gamer tag and contact",
    icon: User,
  },
  {
    href: "/dashboard/apply-admin",
    label: "Apply as organiser",
    description: "Run competitions for your community",
    icon: Shield,
  },
];

export const organiserNavigation: readonly NavigationItem[] = [
  {
    href: "/organiser",
    label: "Overview",
    description: "Your organising workspace",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/organiser/tournaments",
    label: "Tournaments",
    description: "Every competition you own",
    icon: Trophy,
  },
  {
    href: "/organiser/tournaments/new",
    label: "New tournament",
    description: "Create a competition",
    icon: Plus,
    exact: true,
  },
  {
    href: "/organiser/settings",
    label: "Organiser profile",
    description: "Public organisation page",
    icon: User,
    exact: true,
  },
];

interface TournamentWorkspaceItem {
  readonly segment: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** Sub-routes of a single tournament, in operational order. */
export const organiserTournamentWorkspace: readonly TournamentWorkspaceItem[] = [
  { segment: "", label: "Tournament overview", icon: LayoutDashboard },
  { segment: "registrations", label: "Registrations", icon: Users },
  { segment: "pots", label: "Pots and draw", icon: CircleDot },
  { segment: "fixtures", label: "Fixtures", icon: CalendarDays },
  { segment: "results", label: "Results", icon: ClipboardList },
  { segment: "standings", label: "Standings", icon: ListOrdered },
  { segment: "knockout", label: "Knockout", icon: Swords },
  { segment: "result-reports", label: "Result reports", icon: Flag },
  { segment: "announcements", label: "Announcements", icon: Megaphone },
  { segment: "graphics", label: "Graphics", icon: ImageIcon },
  { segment: "settings", label: "Settings", icon: Settings },
];

export function organiserTournamentNavigation(tournamentId: string): readonly NavigationItem[] {
  return organiserTournamentWorkspace.map((item) => ({
    href: `/organiser/tournaments/${tournamentId}${item.segment ? `/${item.segment}` : ""}`,
    label: item.label,
    icon: item.icon,
    exact: item.segment === "",
  }));
}

export const superAdminNavigation: readonly NavigationItem[] = [
  {
    href: "/super-admin",
    label: "Overview",
    description: "Platform health and queues",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/super-admin/users",
    label: "Users",
    description: "Accounts, roles and status",
    icon: Users,
  },
  {
    href: "/super-admin/applications",
    label: "Applications",
    description: "Organiser applications",
    icon: ClipboardList,
  },
  {
    href: "/super-admin/tournaments",
    label: "Tournaments",
    description: "Every competition on GCC",
    icon: Trophy,
  },
  {
    href: "/super-admin/result-reports",
    label: "Result reports",
    description: "Player reports about recorded results",
    icon: Flag,
  },
  {
    href: "/super-admin/announcements",
    label: "Announcements",
    description: "Platform-wide communication",
    icon: Megaphone,
  },
  {
    href: "/super-admin/analytics",
    label: "Analytics",
    description: "Verified platform metrics",
    icon: BarChart3,
  },
  {
    href: "/super-admin/audit-log",
    label: "Audit log",
    description: "Privileged action history",
    icon: ScrollText,
  },
  {
    href: "/super-admin/settings",
    label: "Settings",
    description: "Platform configuration",
    icon: Settings,
  },
];

/** Extracts the tournament id from an organiser workspace path, if present. */
export function tournamentIdFromOrganiserPath(pathname: string): string | null {
  const match = /^\/organiser\/tournaments\/([^/]+)(?:\/|$)/.exec(pathname);

  if (!match?.[1] || match[1] === "new") {
    return null;
  }

  return match[1];
}

// ---------------------------------------------------------------------------
// One navigation model for every signed-in surface.
//
// The mobile top bar, the bottom tab bar, the account menu sheet, the desktop
// user dropdown and the workspace segmented strip all read from here. Items
// that a viewer cannot open are filtered out by role, so the chrome can never
// advertise a route the server would reject. Server guards remain the real
// protection.

export interface NavigationGroup {
  readonly id: "account" | "explore" | "manage";
  readonly label: string;
  readonly items: readonly NavigationItem[];
}

export interface NavigationViewer {
  readonly role: UserRole;
  readonly isSuperAdmin: boolean;
}

export interface ViewerNavigation {
  /** Persistent mobile bottom tabs, in order. */
  readonly tabs: readonly NavigationItem[];
  /** Sectioned menu used by the mobile sheet. */
  readonly groups: readonly NavigationGroup[];
  /** Desktop header dropdown items. Sign out is rendered separately. */
  readonly desktopUser: readonly NavigationItem[];
  /** Workspace entry for organisers and super admins, if any. */
  readonly workspace: NavigationItem | null;
}

const accountNavigation: readonly NavigationItem[] = [
  {
    href: "/dashboard/profile",
    label: "My profile",
    description: "Your public player card",
    icon: User,
    activePrefixes: ["/dashboard/profile"],
  },
  {
    href: "/dashboard/tournaments",
    label: "My tournaments",
    description: "Competitions you have entered",
    icon: Trophy,
  },
  {
    href: "/dashboard/fixtures",
    label: "My matches",
    description: "Every fixture and result",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    description: "Competition and account updates",
    icon: Bell,
  },
  {
    href: "/dashboard/profile/edit",
    label: "Edit profile",
    description: "Display details and contact number",
    icon: Pencil,
    exact: true,
  },
];

const exploreNavigation: readonly NavigationItem[] = [
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/rankings", label: "Rankings", icon: ListOrdered },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Shield },
  { href: "/archives", label: "Archives", icon: ScrollText },
  { href: "/about", label: "About", icon: Info },
  { href: "/contact", label: "Contact", icon: Mail },
];

/** Sectioned menu used by the mobile sheet. */
export const mobileTabNavigation: readonly NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: Home,
    exact: true,
    // The dashboard is home for anything under /dashboard that is not one of
    // the dedicated tabs below.
    activePrefixes: [
      "/dashboard/tournaments",
      "/dashboard/notifications",
      "/dashboard/apply-admin",
    ],
  },
  {
    href: "/tournaments",
    label: "Tournaments",
    icon: Trophy,
  },
  {
    href: "/dashboard/fixtures",
    label: "My matches",
    icon: Swords,
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    icon: User,
    activePrefixes: ["/dashboard/profile"],
  },
];

export const organiserWorkspaceItem: NavigationItem = {
  href: "/organiser",
  label: "Organiser workspace",
  description: "Run and review your competitions",
  icon: Shield,
};

export const superAdminWorkspaceItem: NavigationItem = {
  href: "/super-admin",
  label: "Super admin console",
  description: "Platform administration",
  icon: Compass,
};

/**
 * True when `pathname` belongs to `item`, including any extra active prefixes.
 * A prefix only matches on a path boundary, so `/dashboard/profile` does not
 * match `/dashboard/profile-archive`.
 */
export function isNavigationItemCurrent(item: NavigationItem, pathname: string): boolean {
  const matchesPrefix = (prefix: string): boolean =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (matchesPrefix(item.href)) {
    return item.exact ? pathname === item.href : true;
  }

  return (item.activePrefixes ?? []).some(matchesPrefix);
}

/** Walks a pathname through the tab list and returns the tab to highlight. */
export function activeMobileTab(pathname: string): NavigationItem | null {
  return (
    mobileTabNavigation.find((item) => isNavigationItemCurrent(item, pathname)) ??
    // Unmatched dashboard sub-pages still live under Home.
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/")
      ? (mobileTabNavigation[0] ?? null)
      : null)
  );
}

/**
 * Builds the role-filtered navigation for one viewer. The returned object is
 * serialisable except for the icon components, which the client renders.
 */
export function viewerNavigation(viewer: NavigationViewer): ViewerNavigation {
  const canOrganise = viewer.role === "organiser" || viewer.isSuperAdmin;
  const isSuperAdmin = viewer.isSuperAdmin || viewer.role === "super_admin";

  const manageItems: NavigationItem[] = [];
  const desktopUser: NavigationItem[] = [...accountNavigation.slice(0, 4)];

  if (canOrganise) {
    manageItems.push(organiserWorkspaceItem);
    desktopUser.push(organiserWorkspaceItem);
  }

  if (isSuperAdmin) {
    manageItems.push(superAdminWorkspaceItem);
    desktopUser.push(superAdminWorkspaceItem);
  }

  const groups: NavigationGroup[] = [
    { id: "account", label: "Account", items: accountNavigation },
    { id: "explore", label: "Explore", items: exploreNavigation },
  ];

  if (manageItems.length > 0) {
    groups.push({ id: "manage", label: "Manage", items: manageItems });
  }

  return {
    tabs: mobileTabNavigation,
    groups,
    desktopUser,
    workspace: manageItems[0] ?? null,
  };
}
