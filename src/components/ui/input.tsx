"use client";

// GCC - text inputs, textarea and select.
import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { useFieldControl } from "@/components/ui/form-field";
import { cn } from "@/lib/utils/cn";

const controlStyles =
  "block w-full rounded-md border bg-navy-900/70 px-3 py-2.5 text-sm text-white shadow-sm transition-colors " +
  "placeholder:text-grey-500 focus:outline-none focus:ring-2 focus:ring-electric-400/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const stateStyles = {
  normal: "border-white/15 focus:border-electric-400",
  invalid: "border-danger/60 focus:border-danger focus:ring-danger/20",
} as const;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id, invalid, required, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const field = useFieldControl();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;

  return (
    <input
      ref={ref}
      id={id ?? field?.id}
      required={required ?? field?.required}
      aria-invalid={resolvedInvalid || undefined}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={cn(
        controlStyles,
        resolvedInvalid ? stateStyles.invalid : stateStyles.normal,
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, invalid, required, "aria-describedby": ariaDescribedBy, rows = 4, ...props },
  ref,
) {
  const field = useFieldControl();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;

  return (
    <textarea
      ref={ref}
      id={id ?? field?.id}
      rows={rows}
      required={required ?? field?.required}
      aria-invalid={resolvedInvalid || undefined}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={cn(
        controlStyles,
        "min-h-24 resize-y leading-6",
        resolvedInvalid ? stateStyles.invalid : stateStyles.normal,
        className,
      )}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, id, invalid, required, children, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const field = useFieldControl();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;

  return (
    <span className="relative block">
      <select
        ref={ref}
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={resolvedInvalid || undefined}
        aria-describedby={ariaDescribedBy ?? field?.describedBy}
        className={cn(
          controlStyles,
          "appearance-none pr-10",
          resolvedInvalid ? stateStyles.invalid : stateStyles.normal,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400"
      />
    </span>
  );
});
