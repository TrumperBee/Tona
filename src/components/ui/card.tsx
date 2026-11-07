// GCC - surface containers and status pills.
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type CardVariant = "default" | "elevated" | "outline" | "gold";

const cardVariants: Record<CardVariant, string> = {
  default: "border-white/10 bg-navy-900/60",
  elevated: "border-white/10 bg-navy-900/90 shadow-card",
  outline: "border-white/15 bg-transparent",
  gold: "border-gold-400/25 bg-gold-400/[0.04]",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
}

export function Card({ className, variant = "default", ...props }: CardProps) {
  return <div className={cn("rounded-xl border", cardVariants[variant], className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-white/10 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-xl font-semibold uppercase tracking-display text-white",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-sm leading-6 text-grey-400", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 border-t border-white/10 p-5", className)}
      {...props}
    />
  );
}

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-white/15 bg-white/[0.06] text-grey-200",
  info: "border-electric-400/30 bg-electric-500/10 text-electric-200",
  success: "border-success/30 bg-success/10 text-success-soft",
  warning: "border-warning/30 bg-warning/10 text-warning-soft",
  danger: "border-danger/30 bg-danger/10 text-danger-soft",
  gold: "border-gold-400/30 bg-gold-400/10 text-gold-200",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export interface StatusPillProps extends Omit<BadgeProps, "children"> {
  readonly children: ReactNode;
  readonly pulse?: boolean;
}

export function StatusPill({
  tone = "neutral",
  pulse = false,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <Badge tone={tone} className={cn("gap-2", className)} {...props}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {pulse ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        ) : null}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {children}
    </Badge>
  );
}
