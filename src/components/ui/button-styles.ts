// GCC - button class recipes.
//
// Kept free of "use client" so server components can compose link-styled
// buttons without importing the client Button component. Any server page that
// renders an <a> or <Link> as a button imports from here.
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-electric-500 text-navy-950 hover:bg-electric-400 active:bg-electric-600 shadow-[0_10px_30px_-12px_rgba(46,155,255,0.65)]",
  secondary:
    "border border-white/15 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.08]",
  ghost: "text-grey-200 hover:bg-white/[0.06] hover:text-white",
  danger: "bg-danger text-white hover:bg-danger/90 active:bg-danger/80",
  gold: "bg-gold-400 text-navy-950 hover:bg-gold-300 active:bg-gold-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

export interface ButtonStyleOptions {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
}

/** Shared class recipe so links can look like buttons without nesting them. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
    "disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}
