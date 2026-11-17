// GCC - offline QR generation for graphic templates.
//
// The QR is produced on the server as an inline SVG data URL, so the client
// never needs a network request or a second rendering pass before export.
import "server-only";

import QRCode from "qrcode";

export interface QrOptions {
  readonly dark?: string;
  readonly light?: string;
  readonly margin?: number;
}

/**
 * Renders a URL to an SVG data URL with a quiet-zone margin of 0 (the template
 * draws its own white padding). Returns an empty string when the URL cannot be
 * encoded, so a template degrades to text instead of failing the whole export.
 */
export async function qrSvgDataUrl(value: string, options: QrOptions = {}): Promise<string> {
  if (value.trim().length === 0) {
    return "";
  }

  try {
    const svg = await QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: options.margin ?? 0,
      color: {
        dark: options.dark ?? "#050F1F",
        light: options.light ?? "#FFFFFF",
      },
    });

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return "";
  }
}
