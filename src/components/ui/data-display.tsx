// GCC - empty state, avatar, stat card and breadcrumbs.
//
// Deliberately not a client module: server pages render these directly with
// Lucide icon components, which cannot cross a client boundary. Interactive
// countdowns live in countdown.tsx.
import NextImage from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  readonly icon?: LucideIcon;
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly secondaryAction?: ReactNode;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
}

const emptySizes = {
  sm: "px-5 py-8",
  md: "px-6 py-12",
  lg: "px-6 py-16 md:py-20",
} as const;

export function EmptyState({
  icon: Icon = Clock,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-white/15 bg-navy-900/30 text-center",
        emptySizes[size],
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full border border-electric-400/25 bg-electric-500/10 text-electric-300">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      {eyebrow ? (
        <p className="mt-5 text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-display text-white">
        {title}
      </h2>
      {description ? (
        <div className="mt-3 max-w-md text-sm leading-6 text-grey-400">{description}</div>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const avatarSizes: Record<AvatarSize, { box: string; text: string; pixels: number }> = {
  xs: { box: "h-6 w-6", text: "text-[10px]", pixels: 24 },
  sm: { box: "h-8 w-8", text: "text-xs", pixels: 32 },
  md: { box: "h-10 w-10", text: "text-sm", pixels: 40 },
  lg: { box: "h-14 w-14", text: "text-lg", pixels: 56 },
  xl: { box: "h-20 w-20", text: "text-2xl", pixels: 80 },
};

export interface AvatarProps {
  readonly name: string;
  readonly src?: string | null;
  readonly size?: AvatarSize;
  readonly className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const dimensions = avatarSizes[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-navy-800 font-display font-semibold uppercase text-electric-200",
        dimensions.box,
        dimensions.text,
        className,
      )}
    >
      {src ? (
        <NextImage
          src={src}
          alt={name}
          width={dimensions.pixels}
          height={dimensions.pixels}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
      {!src ? <span className="sr-only">{name}</span> : null}
    </span>
  );
}

export interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly icon?: LucideIcon;
  readonly className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-white">
            {value}
          </p>
        </div>
        {Icon ? (
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs leading-5 text-grey-500">{hint}</p> : null}
    </Card>
  );
}

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
  readonly className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-grey-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight aria-hidden="true" className="h-3 w-3 text-grey-600" />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded transition-colors hover:text-grey-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "text-grey-300" : ""}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
