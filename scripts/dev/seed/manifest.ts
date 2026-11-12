// GCC - seeder manifest and local log.
//
// The manifest is the ONLY authority for which accounts the seeder may clean
// up. It lives outside git (`.seed/` is ignored) because it contains the batch
// password, and it is bound to the Firebase project that created it.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const SEED_DIR = ".seed";
export const TEST_EMAIL_DOMAIN = "gcc-test.example";

/**
 * `.seed/` by default. Integration tests point GCC_SEED_DIR at a temporary
 * directory so they can never overwrite a developer's real manifest.
 */
export function seedDirectory(): string {
  return process.env.GCC_SEED_DIR?.trim() || SEED_DIR;
}

export function manifestPath(): string {
  return join(seedDirectory(), "manifest.json");
}

export function logPath(): string {
  return join(seedDirectory(), "seed.log");
}

export interface ManifestAccount {
  readonly uid: string;
  readonly gamerTag: string;
  readonly email: string;
  readonly password: string;
  readonly slot: number;
}

export interface SeedManifest {
  readonly version: 1;
  readonly batchId: string;
  readonly createdAt: string;
  readonly projectId: string;
  readonly accounts: readonly ManifestAccount[];
}

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedError";
  }
}

/** Deterministic test address for a candidate slot. */
export function testEmail(slot: number): string {
  return `testplayer${String(slot).padStart(2, "0")}@${TEST_EMAIL_DOMAIN}`;
}

function ensureSeedDir(): void {
  mkdirSync(seedDirectory(), { recursive: true });
}

function isManifestAccount(value: unknown): value is ManifestAccount {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const account = value as Record<string, unknown>;

  return (
    typeof account.uid === "string" &&
    typeof account.gamerTag === "string" &&
    typeof account.email === "string" &&
    typeof account.password === "string" &&
    typeof account.slot === "number"
  );
}

function isManifest(value: unknown): value is SeedManifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const manifest = value as Record<string, unknown>;

  return (
    manifest.version === 1 &&
    typeof manifest.batchId === "string" &&
    typeof manifest.createdAt === "string" &&
    typeof manifest.projectId === "string" &&
    Array.isArray(manifest.accounts) &&
    manifest.accounts.every(isManifestAccount)
  );
}

/** Reads the manifest, or returns null when the seeder has never run. */
export function readManifest(): SeedManifest | null {
  if (!existsSync(manifestPath())) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(manifestPath(), "utf8"));
  } catch {
    throw new SeedError(
      `${manifestPath()} is not valid JSON. Fix or remove it before running again.`,
    );
  }

  if (!isManifest(parsed)) {
    throw new SeedError(
      `${manifestPath()} has an unknown shape. Fix or remove it before running again.`,
    );
  }

  return parsed;
}

/** Writes the manifest atomically so a crash cannot leave half a JSON file. */
export function writeManifest(manifest: SeedManifest): void {
  ensureSeedDir();

  const temporary = `${manifestPath()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  renameSync(temporary, manifestPath());
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /password|token|secret|private.?key/i.test(key) ? "[redacted]" : redact(entry),
      ]),
    );
  }

  return value;
}

/**
 * Appends one structured event to `.seed/seed.log`. Passwords, tokens and
 * private keys are redacted defensively in addition to never being passed in.
 */
export function logEvent(event: string, details: Record<string, unknown> = {}): void {
  ensureSeedDir();

  const entry = {
    at: new Date().toISOString(),
    event,
    ...(redact(details) as Record<string, unknown>),
  };

  appendFileSync(logPath(), `${JSON.stringify(entry)}\n`, "utf8");
}
