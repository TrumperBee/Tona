"use client";

// GCC - toast notifications.
//
// The provider owns a polite live region. Toasts are informational; a blocking
// confirmation uses ConfirmDialog instead.
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  readonly title: string;
  readonly description?: string;
  readonly tone?: ToastTone;
  readonly duration?: number;
}

interface ToastRecord extends ToastOptions {
  readonly id: string;
}

interface ToastContextValue {
  readonly toast: (options: ToastOptions) => void;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  info: "border-electric-400/30 bg-navy-800",
  success: "border-success/30 bg-navy-800",
  warning: "border-warning/30 bg-navy-800",
  danger: "border-danger/30 bg-navy-800",
};

const toneIcons: Record<ToastTone, ReactNode> = {
  info: <Info aria-hidden="true" className="h-5 w-5 text-electric-300" />,
  success: <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-success-soft" />,
  warning: <AlertTriangle aria-hidden="true" className="h-5 w-5 text-warning-soft" />,
  danger: <XCircle aria-hidden="true" className="h-5 w-5 text-danger-soft" />,
};

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { ...options, id }]);

      window.setTimeout(() => dismiss(id), options.duration ?? 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((item) => {
          const tone = item.tone ?? "info";

          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full animate-toast-in items-start gap-3 rounded-lg border p-4 shadow-dialog",
                toneStyles[tone],
              )}
            >
              <span className="mt-0.5 shrink-0">{toneIcons[tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm leading-5 text-grey-300">{item.description}</p>
                ) : null}
              </div>
              <IconButton
                label="Dismiss notification"
                size="sm"
                variant="ghost"
                onClick={() => dismiss(item.id)}
                className="-mr-1 -mt-1"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider.");
  }

  return context;
}
