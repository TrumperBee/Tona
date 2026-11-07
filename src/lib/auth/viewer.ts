// GCC - serialisable viewer passed from server layouts to client chrome.
import type { UserRole } from "@/types/domain";

export interface Viewer {
  readonly email: string;
  readonly role: UserRole;
  readonly isSuperAdmin: boolean;
}

/** Route that best represents a signed-in viewer's workspace. */
export function viewerHome(role: UserRole): string {
  if (role === "super_admin") {
    return "/super-admin";
  }

  if (role === "organiser") {
    return "/organiser";
  }

  return "/dashboard";
}

export function viewerRoleLabel(role: UserRole): string {
  if (role === "super_admin") {
    return "Super Admin";
  }

  if (role === "organiser") {
    return "Organiser";
  }

  return "Dashboard";
}

export function viewerDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "Player";
  return local.length > 0 ? local : "Player";
}
