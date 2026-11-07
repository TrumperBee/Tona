// GCC — DOM-to-PNG export helpers for tournament graphics.
// The graphics approach is HTML/CSS/SVG rendered in the browser, captured with
// html-to-image; no paid external graphics APIs.
// TODO(phase 15): implement exportElementAsPng with fonts-ready waiting,
// pixel ratio control and a downloadable file name.

export interface PngExportOptions {
  readonly pixelRatio?: number;
  readonly backgroundColor?: string;
  readonly fileName?: string;
}
