"use client";

// GCC - tournament cover and logo picker.
//
// The browser never sends a URL. It scales the image in the browser (the cover
// to fit inside 1600x900, the logo inside 512x512; aspect ratios are kept and
// nothing is cropped), posts the bytes, and the server verifies the magic
// bytes, uploads with its own Cloudinary credentials and persists the
// reference through the editable-fields matrix.
import { ImageIcon, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MAX_AVATAR_BYTES } from "@/lib/profile/image";
import { cn } from "@/lib/utils/cn";

export interface TournamentImageUploaderProps {
  readonly kind: "cover" | "logo";
  readonly tournamentId: string;
  readonly name: string;
  readonly initialUrl: string | null;
  /** Notifies the parent (the wizard review) whenever the stored image changes. */
  readonly onChange?: (url: string | null) => void;
  readonly disabled?: boolean;
}

const MAX_SOURCE_BYTES = 20_000_000;
const OUTPUT_MAX = { cover: 1600, logo: 512 } as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be opened."));
    image.src = url;
  });
}

function drawContained(canvas: HTMLCanvasElement, image: HTMLImageElement, max: number): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const scale = Math.min(max / image.naturalWidth, max / image.naturalHeight, 1);
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

async function compress(image: HTMLImageElement, max: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawContained(canvas, image, max);

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

export function TournamentImageUploader({
  kind,
  tournamentId,
  name,
  initialUrl,
  onChange,
  disabled = false,
}: TournamentImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(next: string | null): void {
    setUrl(next);
    onChange?.(next);
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

    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(sourceUrl);

      setUploading(true);

      try {
        const blob = await compress(image, OUTPUT_MAX[kind]);
        const form = new FormData();
        form.append("image", blob, `${kind}.webp`);

        const response = await fetch(`/api/organiser/tournaments/${tournamentId}/${kind}`, {
          method: "POST",
          body: form,
        });
        const body = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };

        if (!response.ok || !body.url) {
          setError(body.error ?? "We could not save that image. Try again.");
          return;
        }

        apply(body.url);
      } finally {
        setUploading(false);
      }
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : "We could not save that image.");
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function remove(): Promise<void> {
    setRemoving(true);
    setError(null);

    try {
      const response = await fetch(`/api/organiser/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "cover" ? { coverImageUrl: null } : { logoUrl: null }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "We could not remove that image. Try again.");
        return;
      }

      apply(null);
      setRemoveOpen(false);
    } catch {
      setError("The connection failed. Check your network and try again.");
    } finally {
      setRemoving(false);
    }
  }

  const isCover = kind === "cover";

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "grid place-items-center overflow-hidden rounded-xl border border-white/15 bg-navy-950/60",
          isCover ? "aspect-video w-full max-w-md" : "h-28 w-28",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${name} ${isCover ? "cover" : "logo"}`}
            className={
              isCover ? "h-full w-full object-cover" : "h-full w-full object-contain p-1.5"
            }
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-grey-500">
            <ImageIcon aria-hidden="true" className="h-8 w-8" />
            <p className="text-center text-xs leading-5">
              {isCover ? "No cover image yet" : "No logo yet"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
          onClick={() => inputRef.current?.click()}
          loading={uploading}
          loadingLabel="Uploading"
          disabled={disabled}
        >
          {url ? `Change ${isCover ? "cover" : "logo"}` : `Upload ${isCover ? "cover" : "logo"}`}
        </Button>
        {url ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setRemoveOpen(true)}
            disabled={disabled || removing}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-grey-500">
        {isCover
          ? "JPEG, PNG or WebP, shown 16:9 on the tournament page and cards. Scaled to fit inside 1600x900 in your browser; nothing is cropped."
          : "JPEG, PNG or WebP, shown beside the tournament name. Scaled to fit inside 512x512 in your browser; nothing is cropped."}
      </p>

      {error ? (
        <p role="alert" className="text-xs font-medium leading-5 text-danger-soft">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pick}
        disabled={disabled || uploading}
        className="sr-only"
        aria-label={`Upload ${isCover ? "cover" : "logo"} image`}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove this ${isCover ? "cover" : "logo"}?`}
        description="The image is deleted from storage and a neutral placeholder shows until you upload a new one."
        confirmLabel="Remove image"
        loading={removing}
        onConfirm={remove}
      />
    </div>
  );
}
