"use client";

// GCC - form field wrapper and control context.
//
// The wrapper renders a label, hint and error, then passes the generated ids
// to the control through context so `aria-describedby` and `aria-invalid` stay
// correct without every call site repeating them.
import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface FieldControlContextValue {
  readonly id: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
}

const FieldControlContext = createContext<FieldControlContextValue | null>(null);

export function useFieldControl(): FieldControlContextValue | null {
  return useContext(FieldControlContext);
}

export interface FormFieldProps {
  readonly htmlFor: string;
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly hideLabel?: boolean;
  readonly className?: string;
  readonly labelClassName?: string;
}

export function FormField({
  htmlFor,
  label,
  children,
  hint,
  error,
  required = false,
  optional = false,
  hideLabel = false,
  className,
  labelClassName,
}: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldControlContext.Provider
      value={{ id: htmlFor, describedBy, invalid: Boolean(error), required }}
    >
      <div className={cn("w-full", className)}>
        <label
          htmlFor={htmlFor}
          className={cn(
            "mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-grey-100",
            hideLabel && "sr-only",
            labelClassName,
          )}
        >
          <span>
            {label}
            {required ? (
              <span aria-hidden="true" className="ml-1 text-danger-soft">
                *
              </span>
            ) : null}
          </span>
          {optional ? <span className="text-xs font-normal text-grey-500">Optional</span> : null}
        </label>
        {children}
        {hint && !error ? (
          <p id={hintId} className="mt-1.5 text-xs leading-5 text-grey-400">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-1.5 text-xs font-medium leading-5 text-danger-soft"
          >
            {error}
          </p>
        ) : null}
      </div>
    </FieldControlContext.Provider>
  );
}
