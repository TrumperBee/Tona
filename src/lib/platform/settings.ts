// GCC - platform settings and write gating.
//
// The Firestore document `platformSettings/main` is readable only by the Super
// Admin through Security Rules. Public pages receive the three public-safe
// fields through this server helper, which uses the Admin SDK.
//
// Every state-changing route MUST call `assertPlatformWritable(user)` before
// doing anything else. Future phases must keep following that rule.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { PlatformSettingsDocument } from "@/types/domain";

export const DEFAULT_MAINTENANCE_MESSAGE =
  "GCC is temporarily in maintenance mode. Please check back shortly.";

export const DEFAULT_PLATFORM_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: "",
  registrationsOpen: true,
  maxActiveTournamentsPerOrganiser: 3,
  applicationCooldownDays: 7,
} as const;

export interface PlatformSettingsValues {
  readonly maintenanceMode: boolean;
  readonly maintenanceMessage: string;
  readonly registrationsOpen: boolean;
  readonly maxActiveTournamentsPerOrganiser: number;
  readonly applicationCooldownDays: number;
  readonly updatedBy: string | null;
  readonly updatedAt: Date | null;
}

export interface PublicPlatformSettings {
  readonly maintenanceMode: boolean;
  readonly maintenanceMessage: string;
  readonly registrationsOpen: boolean;
}

export class PlatformWriteBlockedError extends Error {
  readonly status = 503;

  constructor(message = DEFAULT_MAINTENANCE_MESSAGE) {
    super(message);
    this.name = "PlatformWriteBlockedError";
  }
}

export class RegistrationsClosedError extends Error {
  readonly status = 403;

  constructor(message = "Registration is currently closed.") {
    super(message);
    this.name = "RegistrationsClosedError";
  }
}

/** Pure decision used by the helper and unit tests. */
export function isPlatformWriteBlocked(
  settings: Pick<PublicPlatformSettings, "maintenanceMode">,
  user: { readonly role?: string } | null,
): boolean {
  return settings.maintenanceMode && user?.role !== "super_admin";
}

/** Returns the message a blocked caller should receive. */
export function platformWriteBlockMessage(
  settings: Pick<PublicPlatformSettings, "maintenanceMode" | "maintenanceMessage">,
): string {
  return settings.maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE;
}

function toValues(document: PlatformSettingsDocument | undefined): PlatformSettingsValues {
  if (!document) {
    return { ...DEFAULT_PLATFORM_SETTINGS, updatedBy: null, updatedAt: null };
  }

  return {
    maintenanceMode: document.maintenanceMode ?? DEFAULT_PLATFORM_SETTINGS.maintenanceMode,
    maintenanceMessage: document.maintenanceMessage ?? DEFAULT_PLATFORM_SETTINGS.maintenanceMessage,
    registrationsOpen: document.registrationsOpen ?? DEFAULT_PLATFORM_SETTINGS.registrationsOpen,
    maxActiveTournamentsPerOrganiser:
      document.maxActiveTournamentsPerOrganiser ??
      DEFAULT_PLATFORM_SETTINGS.maxActiveTournamentsPerOrganiser,
    applicationCooldownDays:
      document.applicationCooldownDays ?? DEFAULT_PLATFORM_SETTINGS.applicationCooldownDays,
    updatedBy: document.updatedBy ?? null,
    updatedAt: document.updatedAt?.toDate() ?? null,
  };
}

/** Reads the full settings document. Super Admin server code only. */
export async function getPlatformSettings(): Promise<PlatformSettingsValues> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.platformSettingsMain()).get();

  return toValues(snapshot.exists ? (snapshot.data() as PlatformSettingsDocument) : undefined);
}

/** Returns only the three fields that are safe to show on public pages. */
export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const settings = await getPlatformSettings();

  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    registrationsOpen: settings.registrationsOpen,
  };
}

/**
 * Blocks non-Super-Admin callers while maintenance mode is on. Pass `null` when
 * there is no signed-in user yet (registration), which is always blocked.
 */
export async function assertPlatformWritable(
  user: { readonly role?: string } | null,
): Promise<void> {
  const settings = await getPlatformSettings();

  if (isPlatformWriteBlocked(settings, user)) {
    throw new PlatformWriteBlockedError(platformWriteBlockMessage(settings));
  }
}

/** Rejects registration when the Super Admin has closed it. */
export async function assertRegistrationsOpen(): Promise<void> {
  const settings = await getPlatformSettings();

  if (!settings.registrationsOpen) {
    throw new RegistrationsClosedError();
  }
}

/** Writes a complete settings document and returns the serialisable values. */
export async function writePlatformSettings(
  values: Omit<PlatformSettingsValues, "updatedBy" | "updatedAt">,
  updatedBy: string,
): Promise<PlatformSettingsValues> {
  const reference = getFirebaseAdminFirestore().doc(paths.platformSettingsMain());

  await reference.set(
    {
      maintenanceMode: values.maintenanceMode,
      maintenanceMessage: values.maintenanceMessage,
      registrationsOpen: values.registrationsOpen,
      maxActiveTournamentsPerOrganiser: values.maxActiveTournamentsPerOrganiser,
      applicationCooldownDays: values.applicationCooldownDays,
      updatedBy,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return {
    ...values,
    updatedBy,
    updatedAt: new Date(),
  };
}
