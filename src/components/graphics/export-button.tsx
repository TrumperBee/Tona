"use client";

// GCC - "Download image" trigger for a fixed graphic payload.
import { Download, Images } from "lucide-react";
import { useState } from "react";

import { GraphicPreviewDialog } from "@/components/graphics/graphic-preview-dialog";
import { Button } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import type { GraphicBranding, GraphicPayload } from "@/lib/graphics/types";

export interface ExportButtonProps {
  readonly payload: GraphicPayload;
  readonly branding: GraphicBranding;
  readonly label?: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
  readonly icon?: "download" | "images";
  readonly disabled?: boolean;
}

export function ExportButton({
  payload,
  branding,
  label = "Download image",
  variant = "secondary",
  size = "sm",
  className,
  icon = "download",
  disabled = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const Icon = icon === "images" ? Images : Download;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        leftIcon={<Icon aria-hidden="true" className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <GraphicPreviewDialog
        open={open}
        onOpenChange={setOpen}
        payload={payload}
        branding={branding}
      />
    </>
  );
}
