"use client";

// GCC - checkbox and switch controls built on native inputs for full keyboard
// and form semantics.
import { Check } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { useFieldControl } from "@/components/ui/form-field";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    className,
    id,
    label,
    description,
    invalid,
    required,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const field = useFieldControl();
  const resolvedId = id ?? field?.id ?? generatedId;
  const resolvedInvalid = invalid ?? field?.invalid ?? false;
  const descriptionId = description ? `${resolvedId}-description` : undefined;
  const describedBy =
    [ariaDescribedBy ?? field?.describedBy, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={resolvedId}
          type="checkbox"
          required={required ?? field?.required}
          aria-invalid={resolvedInvalid || undefined}
          aria-describedby={describedBy}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none grid h-5 w-5 place-items-center rounded border bg-navy-900 transition-colors",
            "peer-checked:border-electric-400 peer-checked:bg-electric-500",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-electric-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-navy-950",
            "peer-disabled:opacity-50",
            resolvedInvalid ? "border-danger/70" : "border-white/25",
            "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
          )}
        >
          <Check className="h-3.5 w-3.5 text-navy-950" strokeWidth={3} />
        </span>
      </span>
      {label || description ? (
        <span className="min-w-0">
          {label ? (
            <label
              htmlFor={resolvedId}
              className="cursor-pointer text-sm font-medium leading-5 text-grey-100"
            >
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-xs leading-5 text-grey-400">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
});

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    className,
    id,
    label,
    description,
    onCheckedChange,
    required,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const field = useFieldControl();
  const resolvedId = id ?? field?.id ?? generatedId;
  const descriptionId = description ? `${resolvedId}-description` : undefined;
  const describedBy =
    [ariaDescribedBy ?? field?.describedBy, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <label
        htmlFor={resolvedId}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-navy-700 transition-colors",
          "has-[:checked]:bg-electric-500 has-[:disabled]:opacity-50",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-400 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-navy-950",
        )}
      >
        <input
          ref={ref}
          id={resolvedId}
          type="checkbox"
          role="switch"
          required={required ?? field?.required}
          aria-describedby={describedBy}
          onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
        />
      </label>
      {label || description ? (
        <span className="min-w-0">
          {label ? (
            <label
              htmlFor={resolvedId}
              className="cursor-pointer text-sm font-medium leading-6 text-grey-100"
            >
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-xs leading-5 text-grey-400">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
});
