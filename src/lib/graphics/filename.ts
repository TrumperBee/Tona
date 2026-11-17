// GCC - deterministic export file names.
//
// A name never depends on time or randomness, so the same payload always yields
// the same file and a downloaded image can be traced back to its template.
import {
  GRAPHIC_TEMPLATES,
  type GraphicSizeId,
  type GraphicTemplateId,
} from "@/lib/graphics/types";

/**
 * FNV-1a over the serialised payload. It is intentionally not cryptographic:
 * the hash only prevents two different payloads from sharing a file name.
 */
export function stableGraphicHash(value: unknown): string {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

/** Lower-case ASCII slug safe for a downloaded file name. */
export function fileNameSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tournament";
}

/**
 * `gcc-{tournament-slug}-{template}-{hash}.png`, for example
 * `gcc-gcc-invitational-table-8a1f0c2e.png`.
 */
export function graphicFileName(
  template: GraphicTemplateId,
  tournamentSlug: string,
  data: unknown,
  size: GraphicSizeId,
): string {
  const token = GRAPHIC_TEMPLATES[template].fileToken;
  const hash = stableGraphicHash({ template, size, data });

  return `gcc-${fileNameSlug(tournamentSlug)}-${token}-${hash}.png`;
}
