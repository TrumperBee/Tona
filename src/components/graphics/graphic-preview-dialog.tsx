"use client";

// GCC - graphic preview and export dialog.
//
// The visible preview is the same template scaled with a CSS transform. The
// export target is a second, full-size copy positioned off-screen, so the
// capture is never affected by the dialog's width or scroll position.
import { AlertTriangle, CheckCircle2, Download, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GraphicRenderer } from "@/components/graphics/graphic-renderer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  downloadGraphic,
  exportNodeAsPng,
  preloadGraphicImages,
  shareGraphic,
} from "@/lib/graphics/export";
import { graphicFileName } from "@/lib/graphics/filename";
import { collectGraphicImageUrls } from "@/lib/graphics/images";
import {
  GRAPHIC_SIZES,
  GRAPHIC_TEMPLATES,
  type GraphicBranding,
  type GraphicPayload,
  type GraphicSizeId,
} from "@/lib/graphics/types";
import { cn } from "@/lib/utils/cn";

export interface GraphicPreviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly payload: GraphicPayload;
  readonly branding: GraphicBranding;
}

type BusyAction = "download" | "share" | null;

interface StatusMessage {
  readonly tone: "success" | "error";
  readonly text: string;
}

/**
 * The dialog only mounts while it is open, so every open starts from the
 * template's default size and a fresh image preload. No effect has to reset
 * state that a previous visit left behind.
 */
export function GraphicPreviewDialog(props: GraphicPreviewDialogProps) {
  if (!props.open) {
    return null;
  }

  return <GraphicDialogInstance {...props} />;
}

function GraphicDialogInstance({ onOpenChange, payload, branding }: GraphicPreviewDialogProps) {
  const template = GRAPHIC_TEMPLATES[payload.template];
  const [size, setSize] = useState<GraphicSizeId>(template.defaultSize);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string> | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dimensions = GRAPHIC_SIZES[size];
  const urls = useMemo(() => collectGraphicImageUrls(payload, branding), [payload, branding]);
  const blockedImages = useMemo(() => failedImages ?? new Set<string>(), [failedImages]);
  const imagesLoading = urls.length > 0 && failedImages === null;

  useEffect(() => {
    if (urls.length === 0) {
      return;
    }

    let cancelled = false;

    void preloadGraphicImages(urls).then((failed) => {
      if (!cancelled) {
        setFailedImages(failed);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [urls]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const element = previewRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      setPreviewWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const scale = previewWidth > 0 ? Math.min(1, previewWidth / dimensions.width) : 0;
  const fileName = graphicFileName(payload.template, branding.tournamentSlug, payload.data, size);

  async function capture(): Promise<string | null> {
    const node = exportRef.current;

    if (!node) {
      setStatus({ tone: "error", text: "The graphic is not ready yet. Try again in a moment." });
      return null;
    }

    return exportNodeAsPng(node, {
      width: dimensions.width,
      height: dimensions.height,
      pixelRatio: 2,
    });
  }

  async function handleDownload(): Promise<void> {
    setBusy("download");
    setStatus(null);
    const started = performance.now();

    try {
      const dataUrl = await capture();

      if (!dataUrl) {
        return;
      }

      downloadGraphic(dataUrl, fileName);
      setElapsedMs(Math.round(performance.now() - started));
      setStatus({ tone: "success", text: `Downloaded ${fileName}` });
    } catch {
      setStatus({
        tone: "error",
        text: "The image could not be generated. Try again, or use a different browser.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleShare(): Promise<void> {
    setBusy("share");
    setStatus(null);
    const started = performance.now();

    try {
      const dataUrl = await capture();

      if (!dataUrl) {
        return;
      }

      const result = await shareGraphic(dataUrl, fileName, {
        title: `${branding.tournamentName} · ${template.label}`,
        text: `${branding.tournamentName} on GCC.`,
      });

      setElapsedMs(Math.round(performance.now() - started));

      if (result === "shared") {
        setStatus({ tone: "success", text: "Shared." });
      } else if (result === "downloaded") {
        setStatus({
          tone: "success",
          text: "Sharing images is not available here, so the PNG was downloaded instead.",
        });
      }
    } catch {
      setStatus({
        tone: "error",
        text: "The image could not be shared. Try downloading it instead.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={template.label}
      description={`${template.description} Rendered at ${dimensions.width} × ${dimensions.height} px and exported at 2× (${dimensions.width * 2} × ${dimensions.height * 2} px).`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Close
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Share2 aria-hidden="true" className="h-4 w-4" />}
            loading={busy === "share"}
            loadingLabel="Preparing"
            onClick={handleShare}
            disabled={busy !== null || imagesLoading}
          >
            Share
          </Button>
          <Button
            leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
            loading={busy === "download"}
            loadingLabel="Rendering"
            onClick={handleDownload}
            disabled={busy !== null || imagesLoading}
          >
            Download PNG
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {template.sizes.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Graphic size">
            {template.sizes.map((sizeId) => {
              const option = GRAPHIC_SIZES[sizeId];

              return (
                <button
                  key={sizeId}
                  type="button"
                  aria-pressed={size === sizeId}
                  onClick={() => {
                    setSize(sizeId);
                    setStatus(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                    size === sizeId
                      ? "border-electric-400/60 bg-electric-500/[0.12]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25",
                  )}
                >
                  <span className="block text-sm font-semibold text-white">{option.label}</span>
                  <span className="block text-[11px] text-grey-400">
                    {option.width} × {option.height}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          ref={previewRef}
          className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-navy-950"
          style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
        >
          {scale > 0 ? (
            <div
              aria-hidden="true"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                inset: 0,
              }}
            >
              <GraphicRenderer
                payload={payload}
                branding={branding}
                size={size}
                blockedImages={blockedImages}
              />
            </div>
          ) : null}
          {imagesLoading ? (
            <span className="absolute inset-x-0 bottom-0 bg-navy-950/85 px-3 py-2 text-center text-xs font-semibold text-grey-300">
              Loading photos…
            </span>
          ) : null}
        </div>

        {status ? (
          <p
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm leading-5",
              status.tone === "success"
                ? "border-success/30 bg-success/[0.08] text-success-soft"
                : "border-danger/30 bg-danger/[0.08] text-danger-soft",
            )}
          >
            {status.tone === "success" ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {status.text}
              {elapsedMs !== null ? (
                <span className="block text-xs opacity-70">
                  Exported in {(elapsedMs / 1000).toFixed(1)}s on this device.
                </span>
              ) : null}
            </span>
          </p>
        ) : null}

        <p className="text-xs leading-5 text-grey-500">
          The PNG contains only data from this competition. Photos are loaded from the player&apos;s
          own avatar; a missing photo becomes a clean initials badge. Exports are generated in your
          browser and are never uploaded to a graphics service.
        </p>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-20000px",
          top: 0,
          width: dimensions.width,
          height: dimensions.height,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div ref={exportRef}>
          <GraphicRenderer
            payload={payload}
            branding={branding}
            size={size}
            blockedImages={blockedImages}
          />
        </div>
      </div>
    </Dialog>
  );
}
