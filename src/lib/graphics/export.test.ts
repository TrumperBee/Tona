// @vitest-environment jsdom
//
// Export fallbacks keep a graphic downloadable even when webfont embedding or
// a high-resolution capture fails in a browser.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFontEmbedCSS: vi.fn(),
  toPng: vi.fn(),
}));

vi.mock("html-to-image", () => ({
  getFontEmbedCSS: mocks.getFontEmbedCSS,
  toPng: mocks.toPng,
}));

import { exportNodeAsPng, resetFontEmbedCache } from "@/lib/graphics/export";

beforeEach(() => {
  mocks.getFontEmbedCSS.mockReset().mockResolvedValue("embedded-fonts");
  mocks.toPng.mockReset();
  resetFontEmbedCache();
});

describe("exportNodeAsPng", () => {
  it("retries without embedded fonts when the first capture fails", async () => {
    mocks.toPng
      .mockRejectedValueOnce(new Error("font embedding failed"))
      .mockResolvedValueOnce("data:image/png;base64,AAAA");

    const result = await exportNodeAsPng(document.createElement("div"), {
      width: 1080,
      height: 1920,
    });

    expect(result).toBe("data:image/png;base64,AAAA");
    expect(mocks.toPng).toHaveBeenCalledTimes(2);
    expect(mocks.toPng.mock.calls[0]?.[1]).toMatchObject({
      pixelRatio: 2,
      fontEmbedCSS: "embedded-fonts",
    });
    expect(mocks.toPng.mock.calls[1]?.[1]).toMatchObject({
      pixelRatio: 2,
      fontEmbedCSS: "",
    });
  });

  it("falls back to 1x when both full-resolution attempts fail", async () => {
    mocks.toPng
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce("data:image/png;base64,BBBB");

    const result = await exportNodeAsPng(document.createElement("div"), {
      width: 1080,
      height: 1920,
    });

    expect(result).toBe("data:image/png;base64,BBBB");
    expect(mocks.toPng).toHaveBeenCalledTimes(3);
    expect(mocks.toPng.mock.calls[2]?.[1]).toMatchObject({
      pixelRatio: 1,
      fontEmbedCSS: "",
    });
  });
});
