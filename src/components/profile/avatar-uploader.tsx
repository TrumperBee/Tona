"use client";

// GCC - avatar picker, centre-crop preview, client resize/compress and upload.
//
// The browser never sends a URL. It produces a 512x512 WebP/JPEG blob and posts
// the bytes; the server verifies the magic bytes and builds the Cloudinary URL.
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/data-display";
import { Dialog } from "@/components/ui/dialog";
import { MAX_AVATAR_BYTES } from "@/lib/profile/image";

export interface AvatarUploaderProps {
  readonly name: string;
  readonly initialAvatarUrl: string | null;
}

const OUTPUT_SIZE = 512;
const MAX_SOURCE_BYTES = 20_000_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be opened."));
    image.src = url;
  });
}

function drawCroppedSquare(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const shortest = Math.min(image.naturalWidth, image.naturalHeight);
  const cropSize = Math.max(1, shortest / zoom);
  const sourceX = (image.naturalWidth - cropSize) / 2;
  const sourceY = (image.naturalHeight - cropSize) / 2;

  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compress(image: HTMLImageElement, zoom: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawCroppedSquare(canvas, image, zoom);

  let blob = await canvasToBlob(canvas, "image/webp", 0.86);

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

export function AvatarUploader({ name, initialAvatarUrl }: AvatarUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    return () => URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    if (!editing || !sourceImage || !canvasRef.current) {
      return;
    }

    drawCroppedSquare(canvasRef.current, sourceImage, zoom);
  }, [editing, sourceImage, zoom]);

  function closeEditor(): void {
    setEditing(false);
    setSourceImage(null);
    setSourceUrl(null);
    setZoom(1);
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
      setZoom(1);
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
      const blob = await compress(sourceImage, zoom);
      const form = new FormData();
      form.append("avatar", blob, "avatar.webp");

      const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as {
        avatarUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.avatarUrl) {
        setError(body.error ?? "We could not save that image. Try again.");
        return;
      }

      setAvatarUrl(body.avatarUrl);
      closeEditor();
      router.refresh();
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
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "We could not remove your avatar. Try again.");
        return;
      }

      setAvatarUrl(null);
      setRemoveOpen(false);
      router.refresh();
    } catch {
      setError("The connection failed. Check your network and try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
      <div className="relative">
        <span className="inline-flex rounded-full ring-2 ring-electric-400 ring-offset-4 ring-offset-navy-950">
          <Avatar name={name} src={avatarUrl} size="hero" crossOrigin="anonymous" />
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={avatarUrl ? "Change profile picture" : "Upload profile picture"}
          className="absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border-4 border-navy-950 bg-gold-400 text-navy-950 shadow-lg transition-colors hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
        >
          <Camera aria-hidden="true" className="h-5 w-5" />
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
          >
            {avatarUrl ? "Change picture" : "Add picture"}
          </Button>
          {avatarUrl ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setRemoveOpen(true)}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-grey-500">
          JPEG, PNG or WebP. Cropped to a square and compressed in your browser.
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
        title="Crop your profile picture"
        description="The crop is centred. Use the slider to zoom before uploading."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeEditor} disabled={uploading}>
              Cancel
            </Button>
            <Button loading={uploading} loadingLabel="Uploading" onClick={upload}>
              Use this picture
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            aria-label="Square avatar preview"
            className="mx-auto h-56 w-56 rounded-lg border border-white/15 bg-navy-900"
          />
          <label className="block text-sm font-medium text-grey-200">
            Zoom
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-2 w-full accent-electric-500"
            />
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove your profile picture?"
        description="Your avatar will be deleted from Cloudinary and both profile documents. Your initials will show instead."
        confirmLabel="Remove picture"
        loading={removing}
        onConfirm={remove}
      />
    </div>
  );
}
