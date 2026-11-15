// GCC - compact list row.
//
// The mobile replacement for dense table rows: a 56px minimum target, a leading
// slot (avatar, icon or badge), two lines of text and a trailing slot (value,
// status or chevron). Long labels truncate instead of pushing the page sideways.
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface CompactListRowProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly className?: string;
  /** Renders as a button instead of a div when there is an action. */
  readonly ariaLabel?: string;
}

export function CompactListRow({
  title,
  subtitle,
  leading,
  trailing,
  href,
  onClick,
  className,
  ariaLabel,
}: CompactListRowProps) {
  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-grey-100">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-grey-500">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0 text-xs text-grey-400">{trailing}</span> : null}
    </>
  );

  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 px-3 text-left transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
    "hover:bg-white/[0.04]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

export interface StatPillProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: "default" | "success" | "danger" | "gold";
  readonly className?: string;
}

const pillTones = {
  default: "border-white/10 bg-white/[0.03] text-grey-200",
  success: "border-success/30 bg-success/10 text-success-soft",
  danger: "border-danger/30 bg-danger/10 text-danger-soft",
  gold: "border-gold-400/30 bg-gold-400/10 text-gold-200",
} as const;

export function StatPill({ label, value, tone = "default", className }: StatPillProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
        pillTones[tone],
        className,
      )}
    >
      <span className="text-[12px] font-normal text-grey-400">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
