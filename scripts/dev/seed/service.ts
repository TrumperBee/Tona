// GCC - seeder operations.
//
// Account creation and registration call the production services directly;
// this module only plans, prints, confirms, and (for cleanup) removes test data
// that the application has no route to remove.
import { randomBytes } from "node:crypto";

import { RegistrationError, registerPlayer } from "@/lib/auth/registration";
import type { SessionUser } from "@/lib/auth/session";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { getRegistrationState } from "@/lib/tournament/registration-state";
import { registerPlayerForUser } from "@/lib/tournament/registrations";
import { normalizeGamerTag } from "@/lib/validation/gamer-tag";

import {
  chooseCountry,
  choosePlatform,
  dramaPhone,
  registrationInputFor,
  SEED_CANDIDATES,
  type SeedCandidate,
} from "./candidates";
import {
  logEvent,
  readManifest,
  SeedError,
  testEmail,
  writeManifest,
  type ManifestAccount,
  type SeedManifest,
} from "./manifest";
import {
  formatCleanupPlan,
  formatPlayersPlan,
  type CleanupPlan,
  type CleanupPlanTournament,
  type PlayersPlan,
} from "./plan";
import {
  assertSafeEnvironment,
  cleanabilityRefusal,
  confirmationMatches,
  isEligibleTestAccount,
  isTournamentCleanable,
  mayDeleteAccount,
  type TournamentProgress,
} from "./safety";
import {
  deleteTestAccount,
  deleteTournamentRecord,
  existingAuthEmails,
  existingAuthUids,
  existingTagOwners,
  findTournamentBySlug,
  listTournaments,
  loadPublicProfiles,
  readProgress,
  registeredStatuses,
  registrationMatrix,
  removeTestRegistrations,
  setTestWhatsapp,
  type TournamentRecord,
} from "./tournament-data";

export const MAX_TEST_ACCOUNTS = 36;

export interface SeedIo {
  info(message: string): void;
  warn(message: string): void;
  confirm(question: string): Promise<string>;
}

export interface PlayersOptions {
  readonly slug: string;
  readonly fill: boolean;
  readonly count?: number;
}

export interface PlayersResult {
  readonly created: number;
  readonly reused: number;
  readonly registeredTotal: number;
  readonly noop: boolean;
}

function describeState(record: TournamentRecord): string {
  return getRegistrationState(record.data, new Date());
}

function ownerLabel(record: TournamentRecord): string {
  return record.data.ownerTag || record.data.ownerUid;
}

function sessionFor(account: ManifestAccount): SessionUser {
  return {
    userId: account.uid,
    email: account.email,
    role: "user",
    isSuperAdmin: false,
  };
}

function newManifest(projectId: string): SeedManifest {
  return {
    version: 1,
    batchId: `seed-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    projectId,
    accounts: [],
  };
}

function batchPassword(manifest: SeedManifest): string {
  // One password per batch; >= 12 characters and URL-safe for easy manual use.
  return manifest.accounts[0]?.password ?? randomBytes(18).toString("base64url");
}

function profileAllowed(
  profile: { readonly country: string; readonly platform: string },
  record: TournamentRecord,
): boolean {
  const platforms = record.data.allowedPlatforms;
  const countries = record.data.allowedCountries;

  return (
    (!platforms || (platforms as readonly string[]).includes(profile.platform)) &&
    (!countries || countries.map((country) => country.toUpperCase()).includes(profile.country))
  );
}

function assertExactlyOneMode(options: PlayersOptions): void {
  if (options.fill === (options.count !== undefined)) {
    throw new SeedError("Use exactly one of --fill or --count N.");
  }

  if (options.count !== undefined) {
    if (
      !Number.isInteger(options.count) ||
      options.count < 1 ||
      options.count > MAX_TEST_ACCOUNTS
    ) {
      throw new SeedError(`--count must be a whole number from 1 to ${MAX_TEST_ACCOUNTS}.`);
    }
  }
}

interface PlayersPreparation {
  readonly plan: PlayersPlan;
  readonly reuse: readonly ManifestAccount[];
  readonly create: readonly SeedCandidate[];
  readonly manifest: SeedManifest;
  readonly password: string;
}

async function preparePlayers(
  projectId: string,
  record: TournamentRecord,
  options: PlayersOptions,
): Promise<PlayersPreparation> {
  assertExactlyOneMode(options);

  const state = describeState(record);
  let manifest = readManifest();

  if (!manifest) {
    manifest = newManifest(projectId);
  }

  if (manifest.projectId !== projectId) {
    throw new SeedError(
      `.seed/manifest.json belongs to project "${manifest.projectId}", but the current project is ` +
        `"${projectId}". Move or remove .seed/ before running against a different project.`,
    );
  }

  const capacity = Number(record.data.maxParticipants ?? MAX_TEST_ACCOUNTS);
  const registrationCount = Number(record.data.registrationCount ?? 0);
  const statuses = await registeredStatuses(record.id);
  const eligible = manifest.accounts.filter((account) => isEligibleTestAccount(account));
  const currentTestRegistered = eligible.filter(
    (account) => statuses.get(account.uid) === "registered",
  ).length;
  const nonTestRegistered = Math.max(0, registrationCount - currentTestRegistered);
  const targetTestRegistered = options.fill
    ? Math.max(0, capacity - nonTestRegistered)
    : (options.count ?? 0);

  if (targetTestRegistered > capacity - nonTestRegistered) {
    throw new SeedError(
      `${targetTestRegistered} test players plus ${nonTestRegistered} existing entries would exceed ` +
        `the ${capacity}-player field. Nothing was written.`,
    );
  }

  let needed = Math.max(0, targetTestRegistered - currentTestRegistered);
  const warnings: string[] = [];

  // An already-complete field is a no-op even though the effective state is
  // "full": re-running the same command must never fail after a successful
  // fill. Any actual registration still requires the live "open" state.
  if (needed > 0 && state !== "open") {
    throw new SeedError(
      `Registration is not open for "${record.data.name}" (state: ${state}, status: ${record.data.status}). ` +
        "The seeder never changes tournament status, dates or settings. Open registration yourself first.",
    );
  }

  if (record.data.allowedCountries && record.data.allowedCountries.length === 0) {
    throw new SeedError("This tournament allows no countries, so registration cannot succeed.");
  }

  if (record.data.allowedPlatforms && record.data.allowedPlatforms.length === 0) {
    throw new SeedError("This tournament allows no platforms, so registration cannot succeed.");
  }

  // Prefer manifest accounts that already exist but are not registered here.
  const unregistered = eligible.filter((account) => !statuses.has(account.uid));
  const profiles = await loadPublicProfiles(unregistered.map((account) => account.uid));
  const reusable: ManifestAccount[] = [];

  for (const account of unregistered) {
    const profile = profiles.get(account.uid);

    if (!profile) {
      warnings.push(`${account.gamerTag} has no public profile and cannot be registered.`);
      continue;
    }

    if (!profileAllowed(profile, record)) {
      continue;
    }

    reusable.push(account);
  }

  const reuse = reusable.slice(0, needed);
  needed -= reuse.length;

  const usedTags = new Set(manifest.accounts.map((account) => normalizeGamerTag(account.gamerTag)));
  const usedEmails = new Set(manifest.accounts.map((account) => account.email.toLowerCase()));
  const pool = SEED_CANDIDATES.filter(
    (candidate) =>
      !usedTags.has(normalizeGamerTag(candidate.gamerTag)) &&
      !usedEmails.has(testEmail(candidate.slot).toLowerCase()),
  );
  const [tagOwners, authEmails] = await Promise.all([
    existingTagOwners(pool.map((candidate) => candidate.gamerTag)),
    existingAuthEmails(pool.map((candidate) => testEmail(candidate.slot))),
  ]);
  const slotsLeft = Math.max(0, MAX_TEST_ACCOUNTS - manifest.accounts.length);
  const create: SeedCandidate[] = [];

  for (const candidate of pool) {
    if (needed === 0 || create.length >= slotsLeft) {
      break;
    }

    if (tagOwners.has(normalizeGamerTag(candidate.gamerTag))) {
      continue;
    }

    if (authEmails.has(testEmail(candidate.slot).toLowerCase())) {
      warnings.push(
        `${testEmail(candidate.slot)} already exists outside the manifest and was skipped.`,
      );
      continue;
    }

    // A candidate whose preferred game cannot use any allowed platform is
    // skipped; another candidate covers the slot.
    try {
      chooseCountry(candidate, record.data);
      choosePlatform(candidate, record.data);
    } catch {
      continue;
    }

    create.push(candidate);
    needed -= 1;
  }

  if (needed > 0) {
    if (slotsLeft === 0) {
      throw new SeedError(
        `The manifest already holds ${MAX_TEST_ACCOUNTS} test accounts; no slot is left to reach ` +
          `${targetTestRegistered}. Clean up before seeding another tournament.`,
      );
    }

    throw new SeedError(
      `Only ${reuse.length + create.length} of the ${targetTestRegistered} required test players can ` +
        "be supplied from the manifest and the candidate pool. Nothing was written.",
    );
  }

  const plan: PlayersPlan = {
    projectId,
    tournamentName: record.data.name,
    tournamentSlug: record.data.slug,
    tournamentId: record.id,
    ownerTag: ownerLabel(record),
    ownerUid: record.data.ownerUid,
    capacity,
    currentRegistered: registrationCount,
    currentTestRegistered,
    targetTestRegistered,
    reuseAccounts: reuse.map((account) => ({
      gamerTag: account.gamerTag,
      email: account.email,
    })),
    createCandidates: create,
    warnings,
  };

  return { plan, reuse, create, manifest, password: batchPassword(manifest) };
}

async function registerAccount(
  account: ManifestAccount,
  tournamentId: string,
): Promise<"registered" | "already"> {
  try {
    await registerPlayerForUser(sessionFor(account), tournamentId);
    return "registered";
  } catch (error) {
    if (
      error instanceof TournamentMutationError &&
      error.status === 409 &&
      /already registered/i.test(error.message)
    ) {
      return "already";
    }

    throw error;
  }
}

export async function seedPlayers(options: PlayersOptions, io: SeedIo): Promise<PlayersResult> {
  const projectId = assertSafeEnvironment();
  const record = await findTournamentBySlug(options.slug);
  const preparation = await preparePlayers(projectId, record, options);
  const { plan, create } = preparation;

  io.info(formatPlayersPlan(plan));

  if (plan.reuseAccounts.length === 0 && create.length === 0) {
    io.info("\nNothing to do: this tournament already has the requested test players.");
    logEvent("players.noop", {
      projectId,
      tournamentId: record.id,
      tournamentSlug: record.data.slug,
    });
    return {
      created: 0,
      reused: 0,
      registeredTotal: plan.currentRegistered,
      noop: true,
    };
  }

  io.info("");
  const typed = await io.confirm(`Type the Firebase project id (${projectId}) to continue: `);

  if (!confirmationMatches(typed, projectId)) {
    throw new SeedError("Confirmation did not match. Nothing was written.");
  }

  let manifest = preparation.manifest;
  let created = 0;
  let reused = 0;

  logEvent("players.start", {
    projectId,
    tournamentId: record.id,
    tournamentSlug: record.data.slug,
    reuse: plan.reuseAccounts.length,
    create: create.length,
  });

  for (const account of preparation.reuse) {
    const outcome = await registerAccount(account, record.id);

    if (outcome === "registered") {
      reused += 1;
      logEvent("registration.created", {
        projectId,
        tournamentId: record.id,
        uid: account.uid,
        gamerTag: account.gamerTag,
        source: "manifest",
      });
    }
  }

  for (const candidate of create) {
    const input = registrationInputFor(
      candidate,
      record.data,
      preparation.password,
      testEmail(candidate.slot),
    );

    let account: ManifestAccount;

    try {
      const registered = await registerPlayer(input);
      account = {
        uid: registered.uid,
        gamerTag: registered.gamerTag,
        email: registered.email,
        password: preparation.password,
        slot: candidate.slot,
      };
      manifest = { ...manifest, accounts: [...manifest.accounts, account] };
      writeManifest(manifest);
      await setTestWhatsapp(account.uid, dramaPhone(candidate.slot));
      created += 1;
      logEvent("account.created", {
        projectId,
        uid: account.uid,
        gamerTag: account.gamerTag,
        email: account.email,
        slot: account.slot,
      });
    } catch (error) {
      if (
        error instanceof RegistrationError &&
        (error.code === "gamer-tag-taken" || error.code === "email-in-use")
      ) {
        io.warn(`Skipped ${candidate.gamerTag}: ${error.message}`);
        logEvent("account.skipped", {
          projectId,
          gamerTag: candidate.gamerTag,
          reason: error.code,
        });
        continue;
      }

      throw error;
    }

    const outcome = await registerAccount(account, record.id);

    if (outcome !== "registered") {
      continue;
    }

    logEvent("registration.created", {
      projectId,
      tournamentId: record.id,
      uid: account.uid,
      gamerTag: account.gamerTag,
      source: "created",
    });
  }

  const finalRecord = await findTournamentBySlug(record.data.slug);
  const registrationCount = Number(finalRecord.data.registrationCount ?? 0);

  io.info(
    `\nDone: ${created} account(s) created, ${reused} existing account(s) registered. ` +
      `Field: ${registrationCount} / ${finalRecord.data.maxParticipants}.`,
  );
  logEvent("players.done", {
    projectId,
    tournamentId: record.id,
    created,
    reused,
    registrationCount,
  });

  return {
    created,
    reused,
    registeredTotal: registrationCount,
    noop: false,
  };
}

export async function showTournaments(io: SeedIo): Promise<void> {
  const projectId = assertSafeEnvironment();
  const tournaments = await listTournaments();

  io.info(`Firebase project: ${projectId}\n`);

  if (tournaments.length === 0) {
    io.info("No tournaments exist in this project.");
    return;
  }

  io.info("STATUS               REGISTRATION  COUNT  SLUG / NAME");
  io.info("-".repeat(90));

  for (const record of tournaments) {
    const state = describeState(record);
    const count = Number(record.data.registrationCount ?? 0);
    const capacity = Number(record.data.maxParticipants ?? MAX_TEST_ACCOUNTS);

    io.info(
      `${record.data.status.padEnd(20)} ${state.padEnd(13)} ${`${count}/${capacity}`.padEnd(6)} ` +
        `${record.data.slug} — ${record.data.name}`,
    );
  }

  io.info(
    "\nUse: npm run dev:seed -- players --tournament <slug> --fill " +
      "(registration must be open).",
  );
}

export async function showStatus(io: SeedIo): Promise<void> {
  const projectId = assertSafeEnvironment();
  const manifest = readManifest();

  if (!manifest) {
    io.info("No .seed/manifest.json exists: this tool has not created any accounts yet.");
    return;
  }

  if (manifest.projectId !== projectId) {
    throw new SeedError(
      `The manifest belongs to project "${manifest.projectId}", but the current project is ` +
        `"${projectId}". Refusing to report on a different project.`,
    );
  }

  const eligible = manifest.accounts.filter((account) => isEligibleTestAccount(account));
  const ineligible = manifest.accounts.length - eligible.length;
  const [authUids, tournaments] = await Promise.all([
    existingAuthUids(eligible.map((account) => account.uid)),
    listTournaments(),
  ]);
  const matrix = await registrationMatrix(
    tournaments.map((record) => record.id),
    eligible.map((account) => account.uid),
  );
  const missingAuth = eligible.filter((account) => !authUids.has(account.uid));
  const anywhere = new Set<string>();

  io.info(`Firebase project: ${projectId}`);
  io.info(`Batch:            ${manifest.batchId} (created ${manifest.createdAt})`);
  io.info(`Test accounts:    ${manifest.accounts.length} in manifest, ${authUids.size} in Auth`);
  io.info(`Batch password:   stored in .seed/manifest.json (never printed here)`);

  if (ineligible > 0) {
    io.warn(
      `Warning: ${ineligible} manifest account(s) are not eligible for cleanup ` +
        "(wrong domain or Super Admin) and will never be touched.",
    );
  }

  if (missingAuth.length > 0) {
    io.warn(
      `Warning: ${missingAuth.length} account(s) are missing from Auth: ` +
        missingAuth.map((account) => account.gamerTag).join(", "),
    );
  }

  io.info("\nRegistrations by tournament:");

  let found = false;

  for (const record of tournaments) {
    const testUids = [...(matrix.get(record.id)?.keys() ?? [])];

    if (testUids.length === 0) {
      continue;
    }

    found = true;
    testUids.forEach((uid) => anywhere.add(uid));

    const registered = testUids.filter(
      (uid) => matrix.get(record.id)?.get(uid) === "registered",
    ).length;

    io.info(
      `  ${record.data.slug}: ${registered} registered / ${testUids.length} with a registration ` +
        `(${record.data.status}) — ${record.data.name}`,
    );
  }

  if (!found) {
    io.info("  none");
  }

  const unregistered = eligible.filter((account) => !anywhere.has(account.uid));

  if (unregistered.length > 0) {
    io.info(`\nNot registered anywhere: ${unregistered.length} (accounts only)`);
  }
}

export interface CleanupOptions {
  readonly slug?: string;
  readonly deleteTournament: boolean;
  readonly execute: boolean;
}

export interface CleanupResult {
  readonly removedRegistrations: number;
  readonly deletedTournaments: number;
  readonly deletedAccounts: number;
  readonly dryRun: boolean;
  readonly noop: boolean;
}

interface CleanupPreparation {
  readonly plan: CleanupPlan;
  readonly records: ReadonlyMap<string, TournamentRecord>;
  readonly allTournaments: readonly TournamentRecord[];
}

async function prepareCleanup(
  projectId: string,
  options: CleanupOptions,
): Promise<CleanupPreparation | null> {
  if (options.deleteTournament && !options.slug) {
    throw new SeedError("--delete-tournament requires --tournament <slug>.");
  }

  const manifest = readManifest();

  if (!manifest) {
    return null;
  }

  if (manifest.projectId !== projectId) {
    throw new SeedError(
      `The manifest belongs to project "${manifest.projectId}", but the current project is ` +
        `"${projectId}". Move or remove .seed/ before cleaning a different project.`,
    );
  }

  const eligible = manifest.accounts.filter((account) => isEligibleTestAccount(account));
  const ineligible = manifest.accounts.length - eligible.length;
  const allTournaments = await listTournaments();
  const scoped = options.slug ? await findTournamentBySlug(options.slug) : null;
  const scopeTournaments = scoped ? [scoped] : allTournaments;
  const matrix = await registrationMatrix(
    allTournaments.map((record) => record.id),
    eligible.map((account) => account.uid),
  );
  const planTournaments: CleanupPlanTournament[] = [];
  const records = new Map<string, TournamentRecord>();
  const warnings: string[] = [];

  if (ineligible > 0) {
    warnings.push(
      `${ineligible} manifest account(s) are not eligible for cleanup and will never be touched.`,
    );
  }

  for (const record of scopeTournaments) {
    const testUids = [...(matrix.get(record.id)?.keys() ?? [])];

    if (testUids.length === 0 && !(scoped && options.deleteTournament)) {
      continue;
    }

    if (options.deleteTournament) {
      planTournaments.push({
        id: record.id,
        slug: record.data.slug,
        name: record.data.name,
        ownerTag: ownerLabel(record),
        ownerUid: record.data.ownerUid,
        status: record.data.status,
        registrationCount: Number(record.data.registrationCount ?? 0),
        testUids,
        action: "delete-tournament",
      });
      records.set(record.id, record);
      continue;
    }

    const progress: TournamentProgress = await readProgress(record.id);

    if (isTournamentCleanable(record.data.status, progress)) {
      planTournaments.push({
        id: record.id,
        slug: record.data.slug,
        name: record.data.name,
        ownerTag: ownerLabel(record),
        ownerUid: record.data.ownerUid,
        status: record.data.status,
        registrationCount: Number(record.data.registrationCount ?? 0),
        testUids,
        action: "remove-registrations",
      });
      records.set(record.id, record);
      continue;
    }

    const reason = cleanabilityRefusal(record.data.name, record.data.status, progress);

    if (scoped) {
      throw new SeedError(reason ?? "This tournament cannot be partially cleaned.");
    }

    planTournaments.push({
      id: record.id,
      slug: record.data.slug,
      name: record.data.name,
      ownerTag: ownerLabel(record),
      ownerUid: record.data.ownerUid,
      status: record.data.status,
      registrationCount: Number(record.data.registrationCount ?? 0),
      testUids,
      action: "skip-advanced",
      skipReason: reason ?? "Tournament has progressed.",
    });
  }

  const removedTournamentIds = new Set(
    planTournaments
      .filter((tournament) => tournament.action !== "skip-advanced")
      .map((tournament) => tournament.id),
  );
  const accountsToDelete: ManifestAccount[] = [];
  const accountsToKeep: { account: ManifestAccount; reason: string }[] = [];

  for (const account of eligible) {
    const keptBy = allTournaments.find(
      (record) => !removedTournamentIds.has(record.id) && matrix.get(record.id)?.has(account.uid),
    );
    const keptByPlan = planTournaments.find(
      (tournament) =>
        tournament.action === "skip-advanced" && tournament.testUids.includes(account.uid),
    );

    if (keptBy || keptByPlan) {
      accountsToKeep.push({
        account,
        reason: keptBy
          ? `still registered in ${keptBy.data.slug} (${keptBy.data.status})`
          : `registration in ${keptByPlan?.slug ?? "an advanced tournament"} is not cleaned`,
      });
    } else {
      accountsToDelete.push(account);
    }
  }

  const plan: CleanupPlan = {
    projectId,
    tournaments: planTournaments,
    accountsToDelete,
    accountsToKeep,
    warnings,
  };

  return { plan, records, allTournaments };
}

export async function cleanupSeed(options: CleanupOptions, io: SeedIo): Promise<CleanupResult> {
  const projectId = assertSafeEnvironment();
  const preparation = await prepareCleanup(projectId, options);

  if (!preparation) {
    io.info("No .seed/manifest.json exists: nothing to clean.");
    return {
      removedRegistrations: 0,
      deletedTournaments: 0,
      deletedAccounts: 0,
      dryRun: !options.execute,
      noop: true,
    };
  }

  const { plan, records } = preparation;

  io.info(formatCleanupPlan(plan));

  const hasWork =
    plan.tournaments.some((tournament) => tournament.action !== "skip-advanced") ||
    plan.accountsToDelete.length > 0;

  if (!hasWork) {
    io.info("\nNothing to clean.");
    return {
      removedRegistrations: 0,
      deletedTournaments: 0,
      deletedAccounts: 0,
      dryRun: !options.execute,
      noop: true,
    };
  }

  if (!options.execute) {
    io.info("\nDRY RUN ONLY. Re-run exactly the same command with --execute to apply this plan.");
    logEvent("cleanup.dry-run", {
      projectId,
      tournaments: plan.tournaments.map((tournament) => tournament.slug),
      accountsToDelete: plan.accountsToDelete.length,
    });
    return {
      removedRegistrations: 0,
      deletedTournaments: 0,
      deletedAccounts: 0,
      dryRun: true,
      noop: false,
    };
  }

  const typedProject = await io.confirm(
    `\nType the Firebase project id (${projectId}) to continue: `,
  );

  if (!confirmationMatches(typedProject, projectId)) {
    throw new SeedError("Confirmation did not match. Nothing was deleted.");
  }

  const deletions = plan.tournaments.filter(
    (tournament) => tournament.action === "delete-tournament",
  );

  if (deletions.length > 0) {
    const expected = deletions.map((tournament) => tournament.slug).join(", ");
    const typedSlug = await io.confirm(
      `Type the tournament slug (${expected}) to delete it permanently: `,
    );

    if (!confirmationMatches(typedSlug, deletions[0]!.slug)) {
      throw new SeedError("Tournament slug confirmation did not match. Nothing was deleted.");
    }
  }

  let removedRegistrations = 0;
  let deletedTournaments = 0;

  logEvent("cleanup.start", {
    projectId,
    tournaments: plan.tournaments.map((tournament) => tournament.slug),
    accounts: plan.accountsToDelete.length,
  });

  for (const tournament of plan.tournaments) {
    if (tournament.action === "remove-registrations") {
      const removed = await removeTestRegistrations(tournament.id, tournament.testUids);
      removedRegistrations += removed;
      logEvent("cleanup.registrations.removed", {
        projectId,
        tournamentId: tournament.id,
        slug: tournament.slug,
        removed,
      });
      io.info(`Removed ${removed} test registration(s) from ${tournament.slug}.`);
    } else if (tournament.action === "delete-tournament") {
      const record = records.get(tournament.id);

      if (!record) {
        continue;
      }

      await deleteTournamentRecord(record);
      deletedTournaments += 1;
      logEvent("cleanup.tournament.deleted", {
        projectId,
        tournamentId: tournament.id,
        slug: tournament.slug,
        name: tournament.name,
      });
      io.info(`Deleted tournament ${tournament.slug} and all of its subcollections.`);
    }
  }

  // Re-scan before deleting accounts: a registration written after the plan
  // must protect the account, never be orphaned.
  const remainingTournaments = (await listTournaments()).filter(
    (record) => !deletions.some((tournament) => tournament.id === record.id),
  );
  const freshMatrix = await registrationMatrix(
    remainingTournaments.map((record) => record.id),
    plan.accountsToDelete.map((account) => account.uid),
  );
  let deletedAccounts = 0;
  const deletedUids = new Set<string>();
  const currentManifest = readManifest();

  for (const account of plan.accountsToDelete) {
    if (!currentManifest || !mayDeleteAccount(account, currentManifest)) {
      io.warn(`Skipped ${account.gamerTag}: it is no longer eligible in the manifest.`);
      continue;
    }

    const stillRegistered = remainingTournaments.find((record) =>
      freshMatrix.get(record.id)?.has(account.uid),
    );

    if (stillRegistered) {
      io.warn(
        `Kept ${account.gamerTag}: it gained a registration in ${stillRegistered.data.slug}.`,
      );
      continue;
    }

    await deleteTestAccount(account);
    deletedAccounts += 1;
    deletedUids.add(account.uid);
    logEvent("cleanup.account.deleted", {
      projectId,
      uid: account.uid,
      gamerTag: account.gamerTag,
      email: account.email,
    });
  }

  if (deletedUids.size > 0) {
    const latest = readManifest();

    if (latest) {
      writeManifest({
        ...latest,
        accounts: latest.accounts.filter((account) => !deletedUids.has(account.uid)),
      });
    }
  }

  io.info(
    `\nDone: ${removedRegistrations} registration(s) removed, ${deletedTournaments} tournament(s) ` +
      `deleted, ${deletedAccounts} account(s) deleted.`,
  );
  logEvent("cleanup.done", {
    projectId,
    removedRegistrations,
    deletedTournaments,
    deletedAccounts,
  });

  return {
    removedRegistrations,
    deletedTournaments,
    deletedAccounts,
    dryRun: false,
    noop: false,
  };
}
