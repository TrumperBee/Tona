"use client";

// GCC - icon-only button. An accessible label is required by the type.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type IconButtonVariant = "ghost" | "outline" | "solid" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<IconButtonVariant, string> = {
  ghost: "text-grey-300 hover:bg-white/[0.07] hover:text-white",
  outline: "border border-white/15 text-grey-200 hover:border-white/25 hover:text-white",
  solid: "bg-electric-500 text-navy-950 hover:bg-electric-400",
  danger: "bg-danger/15 text-danger-soft hover:bg-danger/25",
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> {
  readonly label: string;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  readonly children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
        "disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
