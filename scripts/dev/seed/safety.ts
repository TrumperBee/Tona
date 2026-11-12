// GCC - seeder safety rules.
//
// These functions are pure so the dangerous decisions (which project, which
// tournament may be cleaned, which account is ours) are unit-testable without
// touching Firebase.
import type { TournamentStatus } from "@/types/domain";

import { SeedError, TEST_EMAIL_DOMAIN, type ManifestAccount, type SeedManifest } from "./manifest";

export const CLEANABLE_STATUSES: readonly TournamentStatus[] = [
  "draft",
  "registration_open",
  "registration_closed",
];

export interface TournamentProgress {
  readonly hasDraw: boolean;
  readonly hasFixtureDraft: boolean;
  readonly hasMatches: boolean;
  readonly hasMatchdays: boolean;
  readonly hasStandings: boolean;
  readonly hasResultReports: boolean;
  readonly hasKnockoutTies: boolean;
}

export function emptyProgress(): TournamentProgress {
  return {
    hasDraw: false,
    hasFixtureDraft: false,
    hasMatches: false,
    hasMatchdays: false,
    hasStandings: false,
    hasResultReports: false,
    hasKnockoutTies: false,
  };
}

export function progressFlags(progress: TournamentProgress): readonly string[] {
  return [
    progress.hasDraw ? "draw" : null,
    progress.hasFixtureDraft ? "fixture draft" : null,
    progress.hasMatches ? "matches" : null,
    progress.hasMatchdays ? "matchdays" : null,
    progress.hasStandings ? "standings" : null,
    progress.hasResultReports ? "result reports" : null,
    progress.hasKnockoutTies ? "knockout ties" : null,
  ].filter((flag): flag is string => flag !== null);
}

/**
 * A tournament may only lose individual registrations while it has not moved
 * past the registration stage and has no competition data. Anything else must
 * be deleted whole (or not at all).
 */
export function isTournamentCleanable(
  status: TournamentStatus,
  progress: TournamentProgress,
): boolean {
  return CLEANABLE_STATUSES.includes(status) && progressFlags(progress).length === 0;
}

export function cleanabilityRefusal(
  name: string,
  status: TournamentStatus,
  progress: TournamentProgress,
): string | null {
  if (isTournamentCleanable(status, progress)) {
    return null;
  }

  const reasons = [
    CLEANABLE_STATUSES.includes(status) ? null : `status is "${status}"`,
    ...progressFlags(progress),
  ].filter((reason): reason is string => reason !== null);

  return (
    `"${name}" has progressed (${reasons.join(", ")}). Partial cleanup is refused. ` +
    "Use --delete-tournament --tournament <slug> to delete the whole competition, " +
    "including its subcollections."
  );
}

/** Exact typed confirmation, with surrounding whitespace ignored. */
export function confirmationMatches(input: string, expected: string): boolean {
  return input.trim() === expected.trim();
}

export function looksLikeEmulatorProject(projectId: string): boolean {
  return /^(demo-|emulator-|fake-)/i.test(projectId) || /(^|-)emulator($|-)/i.test(projectId);
}

/**
 * Refuses production and ambiguous emulator/demo targets before any Firebase
 * call. When an emulator host is set, any project id is safe by definition.
 */
export function assertSafeEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new SeedError("Refusing to run: NODE_ENV=production.");
  }

  const projectId = env.FIREBASE_ADMIN_PROJECT_ID?.trim();

  if (!projectId) {
    throw new SeedError(
      "FIREBASE_ADMIN_PROJECT_ID is not set. Put the Admin credentials in .env.local first.",
    );
  }

  const emulatorMode = Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);

  if (!emulatorMode && looksLikeEmulatorProject(projectId)) {
    throw new SeedError(
      `Refusing to run: project "${projectId}" looks like an emulator/demo project but no ` +
        "emulator host is configured, so the target is ambiguous. Set " +
        "FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST or use the real project id.",
    );
  }

  return projectId;
}

/**
 * Cleanup may only touch accounts created by this tool: present in the
 * manifest, with the reserved test domain, and never the Super Admin.
 */
export function isEligibleTestAccount(
  account: ManifestAccount,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const email = account.email.trim().toLowerCase();
  const superAdminEmail = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const superAdminUid = env.SUPER_ADMIN_UID?.trim();

  return (
    email.endsWith(`@${TEST_EMAIL_DOMAIN}`) &&
    account.uid.length > 0 &&
    account.uid !== superAdminUid &&
    email !== superAdminEmail
  );
}

/**
 * Final defence before deleting an account: it must still be listed in the
 * manifest (same uid AND email) and satisfy the reserved-domain rule. A uid
 * that is not in the manifest can never be deleted, even if it reached a plan.
 */
export function mayDeleteAccount(
  account: ManifestAccount,
  manifest: SeedManifest,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    manifest.accounts.some(
      (entry) =>
        entry.uid === account.uid &&
        entry.email.trim().toLowerCase() === account.email.trim().toLowerCase(),
    ) && isEligibleTestAccount(account, env)
  );
}
