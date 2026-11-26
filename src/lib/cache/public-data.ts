// GCC — shared cache helpers for public, server-rendered data.
//
// Every public data helper caches its Firestore result for a short window and
// tags it with PUBLIC_DATA_TAG. Server-side mutations call
// invalidatePublicData() after a successful write, so a public change is
// visible on the next request instead of waiting for the window to expire.
import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

/** Single tag used by all cached public reads. */
export const PUBLIC_DATA_TAG = "public-data";

/** Revalidation backstop for writes that do not call the invalidation helper. */
export const PUBLIC_DATA_REVALIDATE_SECONDS = 300;

function isIncrementalCacheUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("incrementalCache missing in unstable_cache")
  );
}

/**
 * Wraps a pure server read in the Next.js data cache. Callers must pass every
 * request-dependent value as an argument so it becomes part of the cache key;
 * never read cookies() or headers() inside the wrapped function.
 *
 * Integration tests and standalone scripts run without Next's incremental cache.
 * In that environment the raw read is used so behaviour stays correct; the
 * bounded revalidate window only applies where Next.js provides the cache.
 */
export function cachePublicData<TArgs extends unknown[], TResult>(
  read: (...args: TArgs) => Promise<TResult>,
  keyParts: readonly string[],
  revalidate: number | false = PUBLIC_DATA_REVALIDATE_SECONDS,
): (...args: TArgs) => Promise<TResult> {
  const cached = unstable_cache(read, [...keyParts], {
    tags: [PUBLIC_DATA_TAG],
    revalidate,
  }) as (...args: TArgs) => Promise<TResult>;

  return async (...args: TArgs) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (isIncrementalCacheUnavailable(error)) {
        return read(...args);
      }

      throw error;
    }
  };
}

/** Marks every cached public read stale after a successful mutation. */
export function invalidatePublicData(): void {
  try {
    revalidateTag(PUBLIC_DATA_TAG, "max");
  } catch {
    // Server scripts and unit tests run outside a Next.js request/store. The
    // short revalidate backstop still applies there; production route handlers
    // and server actions always have a store and take the invalidation path.
  }
}

/**
 * Wraps a server write so its successful completion invalidates every cached
 * public read. A failed write leaves the cache untouched.
 */
export function withPublicInvalidation<TArgs extends unknown[], TResult>(
  write: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const result = await write(...args);
    invalidatePublicData();
    return result;
  };
}
