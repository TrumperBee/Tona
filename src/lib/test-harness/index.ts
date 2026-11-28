// GCC - test harness switches.
//
// These switches exist ONLY for emulator-backed E2E runs. They must be
// impossible to activate against a real Firebase project. Every switch is
// checked at call time; unsafe activation refuses and logs.
import "server-only";

import { logger } from "@/lib/observability/logger";

const SAFE_PROJECT_IDS = new Set(["demo-gcc", "demo-gcc-e2e", "gcc-e2e", "tona-d6f56-e2e"]);

function emulatorHostsConfigured(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function isSafeTestProject(): boolean {
  const projectId = (process.env.FIREBASE_ADMIN_PROJECT_ID ?? "").trim();
  if (SAFE_PROJECT_IDS.has(projectId)) return true;
  // demo-* projects are the Firebase emulator convention.
  if (projectId.startsWith("demo-")) return true;
  return false;
}

export function isE2EHarness(): boolean {
  return process.env.GCC_E2E === "1";
}

function assertSafeHarness(feature: string): void {
  if (!isE2EHarness()) {
    throw new Error(`${feature} is only available in the GCC E2E harness.`);
  }
  if (!emulatorHostsConfigured()) {
    logger.error("test_harness.unsafe_activation", new Error("Emulator hosts missing"), {
      feature,
    });
    throw new Error(`${feature} refused: Firebase emulator hosts are not configured.`);
  }
  if (!isSafeTestProject()) {
    logger.error("test_harness.unsafe_activation", new Error("Unsafe project id"), {
      feature,
      projectId: (process.env.FIREBASE_ADMIN_PROJECT_ID ?? "").slice(0, 40),
    });
    throw new Error(
      `${feature} refused: FIREBASE_ADMIN_PROJECT_ID is not an approved E2E project.`,
    );
  }
  if (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.startsWith("demo-") &&
    !SAFE_PROJECT_IDS.has(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  ) {
    logger.error("test_harness.unsafe_activation", new Error("Unsafe public project id"), {
      feature,
    });
    throw new Error(
      `${feature} refused: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not an approved E2E project.`,
    );
  }
}

export function isMockCloudinaryEnabled(): boolean {
  if (process.env.CLOUDINARY_MODE !== "mock") return false;
  assertSafeHarness("CLOUDINARY_MODE=mock");
  return true;
}

export function isEmailCaptureEnabled(): boolean {
  if (process.env.GCC_E2E_CAPTURE_EMAIL !== "1") return false;
  assertSafeHarness("GCC_E2E_CAPTURE_EMAIL");
  return true;
}

export function isTurnstileTestBypassEnabled(): boolean {
  if (process.env.GCC_E2E_TURNSTILE_BYPASS !== "1") return false;
  assertSafeHarness("GCC_E2E_TURNSTILE_BYPASS");
  return true;
}

export function assertHarnessSafeForRuntime(): void {
  if (!isE2EHarness()) return;
  // GCC_E2E can be set in E2E only; still refuse if pointed at non-emulator/unsafe project.
  if (!emulatorHostsConfigured() || !isSafeTestProject()) {
    logger.error("test_harness.unsafe_runtime", new Error("Unsafe E2E runtime"), {
      projectId: (process.env.FIREBASE_ADMIN_PROJECT_ID ?? "").slice(0, 40),
    });
    throw new Error("GCC_E2E refused: emulator hosts and approved demo project id are required.");
  }
}

export { captureEmail, clearCapturedEmails, getCapturedEmails } from "./email-capture";
