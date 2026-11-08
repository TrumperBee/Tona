// GCC - avatar magic-byte detection tests.
import { describe, expect, it } from "vitest";

import { detectImageType, isValidAvatar, MAX_AVATAR_BYTES } from "@/lib/profile/image";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

describe("detectImageType", () => {
  it("detects JPEG from its start-of-image marker", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
  });

  it("detects PNG from the full signature", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe(
      "image/png",
    );
  });

  it("detects WebP from RIFF/WEBP markers", () => {
    const webp = bytes(
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x24,
      0x00,
      0x00,
      0x00, // size (ignored)
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    );
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("rejects other formats and arbitrary data", () => {
    expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBeNull(); // GIF
    expect(detectImageType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull(); // PDF
    expect(detectImageType(bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c))).toBeNull(); // HTML
    expect(detectImageType(bytes())).toBeNull();
  });

  it("rejects a truncated WebP that lacks the WEBP marker", () => {
    const truncated = bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42);
    expect(detectImageType(truncated)).toBeNull();
  });
});

describe("isValidAvatar", () => {
  it("accepts each supported signature and rejects everything else", () => {
    expect(isValidAvatar(bytes(0xff, 0xd8, 0xff))).toBe(true);
    expect(isValidAvatar(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(isValidAvatar(bytes(0x47, 0x49, 0x46))).toBe(false);
  });
});

describe("MAX_AVATAR_BYTES", () => {
  it("caps uploads at one megabyte", () => {
    expect(MAX_AVATAR_BYTES).toBe(1_000_000);
  });
});
