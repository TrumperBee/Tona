"use client";

// GCC - desktop primary navigation.
//
// This client island exists only because active-link highlighting needs the
// current pathname. Everything else in the public header stays server-rendered
// so anonymous pages hydrate as little JavaScript as possible.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavigationItemActive, publicNavigation } from "@/lib/config/public-navigation";
import { cn } from "@/lib/utils/cn";

interface PrimaryNavProps {
  readonly className?: string;
}

export function PrimaryNav({ className }: PrimaryNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={className}>
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
  );
}
