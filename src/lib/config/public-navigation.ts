// GCC - public navigation model.
//
// This module deliberately imports nothing. The public header renders on every
// page, so it must not pull the icon set used by the authenticated workspaces
// into the browser bundle.

export const publicNavigation = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/rankings", label: "Rankings" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/archives", label: "Archives" },
  { href: "/about", label: "About" },
] as const;

/** True when a pathname belongs to a navigation item. */
export function isNavigationItemActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) {
    return true;
  }

  return !exact && pathname.startsWith(`${href}/`);
}
