// GCC — unit tests for the shared public-data cache contract.
import { beforeEach, describe, expect, it, vi } from "vitest";

const nextCache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: nextCache.revalidateTag,
  unstable_cache: nextCache.unstable_cache,
}));

import {
  PUBLIC_DATA_REVALIDATE_SECONDS,
  PUBLIC_DATA_TAG,
  cachePublicData,
  invalidatePublicData,
  withPublicInvalidation,
} from "@/lib/cache/public-data";

describe("public data cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextCache.unstable_cache.mockImplementation(
      (read: unknown, keyParts: unknown, options: unknown) =>
        Object.assign(read as object, { keyParts, options }),
    );
  });

  it("uses one shared tag and a bounded revalidation backstop", async () => {
    const read = async () => "value";
    cachePublicData(read, ["unit-read"]);

    expect(nextCache.unstable_cache).toHaveBeenCalledWith(read, ["unit-read"], {
      tags: [PUBLIC_DATA_TAG],
      revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
    });
    expect(PUBLIC_DATA_REVALIDATE_SECONDS).toBeLessThanOrEqual(300);
  });

  it("invalidates with the Next.js 16 tagged profile", () => {
    invalidatePublicData();

    expect(nextCache.revalidateTag).toHaveBeenCalledWith(PUBLIC_DATA_TAG, "max");
  });

  it("does not throw when invalidation runs outside a Next.js request store", () => {
    nextCache.revalidateTag.mockImplementationOnce(() => {
      throw new Error("no static generation store");
    });

    expect(() => invalidatePublicData()).not.toThrow();
  });

  it("invalidates only after a write succeeds", async () => {
    const success = withPublicInvalidation(async (value: string) => value.toUpperCase());
    const failure = withPublicInvalidation(async () => {
      throw new Error("write failed");
    });

    await expect(success("ok")).resolves.toBe("OK");
    expect(nextCache.revalidateTag).toHaveBeenCalledTimes(1);

    await expect(failure()).rejects.toThrow("write failed");
    expect(nextCache.revalidateTag).toHaveBeenCalledTimes(1);
  });
});
