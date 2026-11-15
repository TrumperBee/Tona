"use client";

// GCC - bottom sheet.
//
// A phone-first surface for menus and short forms. It is the existing `Drawer`
// anchored to the bottom, so it inherits the portal, the scroll lock, the focus
// trap, the Escape handler and focus restoration. The extra frame adds the
// safe-area padding and a grab handle; nothing here is draggable, so no gesture
// can dismiss it by accident.
import type { ReactNode } from "react";

import { Drawer } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

export interface BottomSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly closeLabel?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  closeLabel = "Close",
}: BottomSheetProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={title}
      description={description}
      footer={footer}
      closeLabel={closeLabel}
      className={cn("pb-[env(safe-area-inset-bottom)]", className)}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden"
      />
      {children}
    </Drawer>
  );
}
