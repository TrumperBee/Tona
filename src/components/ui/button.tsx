"use client";

// GCC - primary action button.
//
// Class recipes live in button-styles.ts so server components can style links
// as buttons without importing a client module.
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "@/components/ui/button-styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingLabel = "Working",
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : leftIcon}
      {loading ? <span>{loadingLabel}</span> : children}
      {!loading ? rightIcon : null}
    </button>
  );
});
