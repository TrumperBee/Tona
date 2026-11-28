// GCC - in-memory Cloudinary mock for E2E runs.
//
// Keeps all real validation in route handlers; only storage is mocked.
import "server-only";

import { randomUUID } from "node:crypto";

import { isMockCloudinaryEnabled } from "./index";

type Stored = { bytes: Buffer; mimeType: string; createdAt: number };

const store = new Map<string, Stored>();

function ensureEnabled(): void {
  if (!isMockCloudinaryEnabled()) {
    throw new Error("Mock Cloudinary is not enabled.");
  }
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
}

export function mockUpload(publicId: string, bytes: Buffer, mimeType: string) {
  ensureEnabled();
  store.set(publicId, { bytes: Buffer.from(bytes), mimeType, createdAt: Date.now() });
  return {
    publicId,
    url: `${baseUrl()}/api/test/mock-cloudinary/${encodeURIComponent(publicId)}?v=${randomUUID()}`,
  };
}

export function mockDestroy(publicId: string): void {
  ensureEnabled();
  store.delete(publicId);
}

export function getMockImage(publicId: string): Stored | null {
  ensureEnabled();
  return store.get(publicId) ?? null;
}
