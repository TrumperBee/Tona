"use client";

// GCC - organisation logo picker, contain-fit preview, resize and upload.
//
// The browser never sends a URL. It scales the logo to fit inside 512x512
// (logos keep their aspect ratio; nothing is cropped), posts the bytes, and
// the server verifies the magic bytes and builds the Cloudinary URL.
import { Building2, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";
import { MAX_AVATAR_BYTES } from "@/lib/profile/image";

export interface LogoUploaderProps {
  readonly name: string;
  readonly initialLogoUrl: string | null;
  /** False until the profile document exists; the logo route requires it. */
  readonly canUpload: boolean;
}

const OUTPUT_MAX = 512;
const MAX_SOURCE_BYTES = 20_000_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be opened."));
    image.src = url;
  });
}

function drawContained(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const scale = Math.min(OUTPUT_MAX / image.naturalWidth, OUTPUT_MAX / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compress(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawContained(canvas, image);

  let blob = await canvasToBlob(canvas, "image/webp", 0.9);

  if (blob && blob.size > MAX_AVATAR_BYTES) {
    blob = await canvasToBlob(canvas, "image/webp", 0.7);
  }

  if (!blob || blob.size > MAX_AVATAR_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
  }

  if (!blob || blob.size > MAX_AVATAR_BYTES) {
    throw new Error("That image could not be compressed enough. Try a smaller file.");
  }

  return blob;
}

export function LogoUploader({ name, initialLogoUrl, canUpload }: LogoUploaderProps) {
  const refresh = useRefreshPreservingScroll();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeEditor(): void {
    setEditing(false);
    setSourceImage(null);
    setPreviewUrl(null);

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
    }
  }

  async function pick(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_SOURCE_BYTES) {
      setError("That file is too large. Choose an image under 20 MB.");
      return;
    }

    const url = URL.createObjectURL(file);

    try {
      const image = await loadImage(url);
      setSourceUrl(url);
      setSourceImage(image);
      setPreviewUrl(url);
      setEditing(true);
    } catch {
      URL.revokeObjectURL(url);
      setError("That image could not be opened. Try another file.");
    }
  }

  async function upload(): Promise<void> {
    if (!sourceImage) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const blob = await compress(sourceImage);
      const form = new FormData();
      form.append("logo", blob, "logo.webp");

      const response = await fetch("/api/organiser/logo", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as {
        logoUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.logoUrl) {
        setError(body.error ?? "We could not save that image. Try again.");
        return;
      }

      setLogoUrl(body.logoUrl);
      closeEditor();
      refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "We could not save that image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function remove(): Promise<void> {
    setRemoving(true);
    setError(null);

    try {
      const response = await fetch("/api/organiser/logo", { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "We could not remove your logo. Try again.");
        return;
      }

      setLogoUrl(null);
      setRemoveOpen(false);
      refresh();
    } catch {
      setError("The connection failed. Check your network and try again.");
    } finally {
      setRemoving(false);
    }
  }

  const disabled = !canUpload;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
      <div className="relative">
        <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-navy-900 ring-2 ring-gold-400/60 ring-offset-4 ring-offset-navy-950">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${name} logo`}
              crossOrigin="anonymous"
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <Building2 aria-hidden="true" className="h-10 w-10 text-grey-500" />
          )}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={logoUrl ? "Change organisation logo" : "Upload organisation logo"}
          className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-4 border-navy-950 bg-gold-400 text-navy-950 shadow-lg transition-colors hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          className="sr-only"
        />
      </div>

      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {logoUrl ? "Change logo" : "Add logo"}
          </Button>
          {logoUrl ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setRemoveOpen(true)}
              disabled={disabled}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-grey-500">
          {disabled
            ? "Save your organisation name first, then upload a logo."
            : "JPEG, PNG or WebP. Scaled to fit inside 512x512 in your browser; nothing is cropped."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium leading-5 text-danger-soft">
          {error}
        </p>
      ) : null}

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!open && !uploading) {
            closeEditor();
          }
        }}
        title="Upload your organisation logo"
        description="The logo is scaled to fit inside a square. Its shape is preserved."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeEditor} disabled={uploading}>
              Cancel
            </Button>
            <Button loading={uploading} loadingLabel="Uploading" onClick={upload}>
              Use this logo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid h-56 w-56 place-items-center overflow-hidden rounded-lg border border-white/15 bg-navy-900">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Logo preview"
                className="max-h-full max-w-full object-contain p-3"
              />
            ) : null}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove your organisation logo?"
        description="Your logo will be deleted from Cloudinary and removed from your public organiser page. A placeholder mark will show instead."
        confirmLabel="Remove logo"
        loading={removing}
        onConfirm={remove}
      />
    </div>
  );
}
