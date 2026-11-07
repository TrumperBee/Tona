"use client";

// GCC - modal dialog and side drawer.
//
// Both use the native document layer through a portal, lock background
// scrolling, trap Tab focus, restore focus on close and close on Escape.
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const emptySubscribe = () => () => {};

/**
 * False during server rendering and the hydration pass, true once the client
 * owns the tree. This keeps the portal out of server HTML without setting
 * state from an effect.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function trapTabKey(event: KeyboardEvent, container: HTMLElement | null): void {
  if (event.key !== "Tab" || !container) {
    return;
  }

  const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.offsetParent !== null,
  );

  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
}

export type DialogSize = "sm" | "md" | "lg";

const dialogSizes: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: DialogSize;
  readonly closeLabel?: string;
  readonly className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "Close dialog",
  className,
}: DialogProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.documentElement.dataset.scrollLocked = "true";
    window.setTimeout(() => panelRef.current?.focus(), 0);

    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      trapTabKey(event, panelRef.current);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.documentElement.dataset.scrollLocked;
      previouslyFocused?.focus();
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 animate-fade-in bg-navy-950/80 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[92dvh] w-full animate-scale-in overflow-y-auto rounded-t-2xl border border-white/10 bg-navy-900 shadow-dialog sm:rounded-xl",
          dialogSizes[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-2xl font-semibold uppercase tracking-display text-white"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-grey-400">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            label={closeLabel}
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        {children ? <div className="p-5">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 p-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Alias kept for teams that call the component "Modal". */
export const Modal = Dialog;
export type ModalProps = DialogProps;

export type DrawerSide = "right" | "left" | "bottom";

const drawerSides: Record<DrawerSide, string> = {
  right: "inset-y-0 right-0 h-full w-full max-w-sm animate-slide-in-right border-l",
  left: "inset-y-0 left-0 h-full w-full max-w-sm animate-slide-in-left border-r",
  bottom: "inset-x-0 bottom-0 max-h-[90dvh] w-full animate-slide-in-bottom rounded-t-2xl border-t",
};

export interface DrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly side?: DrawerSide;
  readonly closeLabel?: string;
  readonly className?: string;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  closeLabel = "Close panel",
  className,
}: DrawerProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.documentElement.dataset.scrollLocked = "true";
    window.setTimeout(() => panelRef.current?.focus(), 0);

    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      trapTabKey(event, panelRef.current);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.documentElement.dataset.scrollLocked;
      previouslyFocused?.focus();
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 animate-fade-in bg-navy-950/80 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col border-white/10 bg-navy-900 shadow-dialog focus:outline-none",
          drawerSides[side],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-xl font-semibold uppercase tracking-display text-white"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-grey-400">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            label={closeLabel}
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t border-white/10 p-5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
