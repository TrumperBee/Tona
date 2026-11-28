"use client";

// GCC - DOM-to-PNG export helpers for tournament graphics.
//
// The graphics approach is HTML/CSS/SVG rendered in the browser, captured with
// html-to-image; no external graphics API and no server-side renderer. The
// export node is rendered off-screen at its fixed size, fonts are embedded once
// and images are preloaded so a failed avatar falls back to initials before the
// capture rather than leaving a broken square in the PNG.
import { getFontEmbedCSS, toPng } from "html-to-image";

export interface PngExportOptions {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  readonly backgroundColor?: string;
  readonly fileName?: string;
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

const DEFAULT_BACKGROUND = "#050F1F";
const IMAGE_TIMEOUT_MS = 4000;

/** Safari and every iOS browser share the same html-to-image quirk. */
export function isSafariLike(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;

  return (
    /iP(hone|ad|od)/.test(userAgent) ||
    (/Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(userAgent))
  );
}

/** Waits for the document's font faces before a capture. */
export async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return;
  }

  try {
    await document.fonts.ready;
  } catch {
    // A missing font must not block an export; the fallback stack is used.
  }
}

/**
 * Loads every image off-document with a timeout. The returned set contains the
 * URLs that failed, which the template context turns into initials avatars.
 */
export async function preloadGraphicImages(
  urls: readonly (string | null | undefined)[],
  timeoutMs = IMAGE_TIMEOUT_MS,
): Promise<ReadonlySet<string>> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))];

  if (unique.length === 0 || typeof Image === "undefined") {
    return new Set();
  }

  const failed = new Set<string>();

  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          let settled = false;
          let timer = 0;

          const finish = (ok: boolean): void => {
            if (settled) {
              return;
            }

            settled = true;
            window.clearTimeout(timer);

            if (!ok) {
              failed.add(url);
            }

            resolve();
          };

          timer = window.setTimeout(() => finish(false), timeoutMs);
          image.onload = () => finish(true);
          image.onerror = () => finish(false);
          image.crossOrigin = "anonymous";
          image.src = url;
        }),
    ),
  );

  return failed;
}

let cachedFontEmbedCss: string | null = null;

async function fontEmbedCss(node: HTMLElement): Promise<string> {
  if (cachedFontEmbedCss !== null) {
    return cachedFontEmbedCss;
  }

  try {
    cachedFontEmbedCss = await getFontEmbedCSS(node);
  } catch {
    cachedFontEmbedCss = "";
  }

  return cachedFontEmbedCss;
}

/** Clears the font cache; only unit tests and a font hot-reload need this. */
export function resetFontEmbedCache(): void {
  cachedFontEmbedCss = null;
}

/**
 * Captures one fixed-size node at 2x. Safari renders twice because its first
 * pass can run before webfonts and images are painted; the second pass is kept.
 *
 * A capture is retried without embedded fonts and finally at 1x. Both fallbacks
 * still produce a valid PNG; losing webfont embedding or resolution is better
 * than showing the user a failed generation.
 */
export async function exportNodeAsPng(
  node: HTMLElement,
  options: PngExportOptions,
): Promise<string> {
  await waitForFonts();

  const pixelRatio = options.pixelRatio ?? 2;
  const baseOptions = {
    width: options.width,
    height: options.height,
    backgroundColor: options.backgroundColor ?? DEFAULT_BACKGROUND,
    cacheBust: false,
    skipAutoScale: false,
  };
  const attempts = [
    { ...baseOptions, pixelRatio, fontEmbedCSS: await fontEmbedCss(node) },
    { ...baseOptions, pixelRatio, fontEmbedCSS: "" },
    { ...baseOptions, pixelRatio: 1, fontEmbedCSS: "" },
  ];

  if (isSafariLike()) {
    try {
      await toPng(node, attempts[0] ?? attempts[1]!);
    } catch {
      // The warm-up pass is best-effort; the real attempts below still run.
    }
  }

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return await toPng(node, attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Image export failed");
}

/** Converts a PNG data URL to a Blob without another canvas round-trip. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header ?? "")?.[1] ?? "image/png";
  const binary = atob(encoded ?? "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

/** Saves a data URL under the deterministic graphic file name. */
export function downloadGraphic(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Shares the PNG through the Web Share API when the browser accepts image
 * files, otherwise downloads it. A user-cancelled share never downloads.
 */
export async function shareGraphic(
  dataUrl: string,
  fileName: string,
  share: { readonly title: string; readonly text: string },
): Promise<ShareResult> {
  const blob = dataUrlToBlob(dataUrl);

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  ) {
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: share.title, text: share.text });
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return "cancelled";
        }
      }
    }
  }

  downloadGraphic(dataUrl, fileName);
  return "downloaded";
}
