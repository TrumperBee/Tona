// GCC - loading indicators.
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly label?: string;
}

const sizeStyles = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
} as const;

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  const icon = (
    <Loader2
      aria-hidden="true"
      className={cn("animate-spin text-electric-400", sizeStyles[size], className)}
    />
  );

  if (!label) {
    return icon;
  }

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-grey-300">
      {icon}
      <span>{label}</span>
    </span>
  );
}

export interface SkeletonProps {
  readonly className?: string;
  readonly variant?: "line" | "block" | "circle";
}

export function Skeleton({ className, variant = "line" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden bg-white/[0.06]",
        variant === "line" && "h-4 w-full rounded",
        variant === "block" && "h-24 w-full rounded-lg",
        variant === "circle" && "h-10 w-10 rounded-full",
        className,
      )}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </span>
  );
}
