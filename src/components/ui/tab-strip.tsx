"use client";

// GCC - horizontal tab strip.
//
// The section navigation for the organiser and super-admin workspaces on a
// phone. It scrolls horizontally with snap points, keeps every target at least
// 44px tall, and scrolls the active tab into view when the route changes so the
// current section is never hidden off-screen.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { isNavigationItemCurrent, type NavigationItem } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

export interface TabStripProps {
  readonly items: readonly NavigationItem[];
  readonly ariaLabel: string;
  readonly className?: string;
  readonly accent?: "electric" | "gold";
}

const accentClasses = {
  electric: {
    active: "border-electric-400/60 bg-electric-500/15 text-electric-200",
    idle: "border-white/15 bg-navy-900/60 text-grey-300",
  },
  gold: {
    active: "border-gold-400/60 bg-gold-400/15 text-gold-200",
    idle: "border-white/15 bg-navy-900/60 text-grey-300",
  },
} as const;

export function TabStrip({ items, ariaLabel, className, accent = "electric" }: TabStripProps) {
  const pathname = usePathname() ?? "";
  const activeRef = useRef<HTMLAnchorElement>(null);
  const tones = accentClasses[accent];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label={ariaLabel} className={cn("relative", className)}>
      <ul
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 pt-1",
          "sm:-mx-6 sm:px-6",
          // Hide the scrollbar without removing the ability to scroll.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {items.map((item) => {
          const active = isNavigationItemCurrent(item, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="snap-start">
              <Link
                ref={active ? activeRef : undefined}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                  active ? tones.active : cn(tones.idle, "hover:border-white/30 hover:text-white"),
                )}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface SegmentedControlOption {
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
}

export interface SegmentedControlProps {
  readonly options: readonly SegmentedControlOption[];
  readonly value: string;
  readonly onValueChange: (id: string) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

/**
 * A compact segmented picker for in-page filters. It scrolls horizontally on
 * narrow screens rather than shrinking labels below a readable size.
 */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex snap-x snap-mandatory gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-navy-950/60 p-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(option.id)}
            className={cn(
              "inline-flex min-h-10 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
              active ? "bg-electric-500/20 text-white" : "text-grey-400 hover:text-white",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
