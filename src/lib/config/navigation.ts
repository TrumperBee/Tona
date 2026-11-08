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
  Flag,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
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

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
  readonly icon: LucideIcon;
  /** Match only the exact path rather than a nested prefix. */
  readonly exact?: boolean;
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
