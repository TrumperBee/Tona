// GCC - human-readable write plans.
//
// Every writing command prints one of these BEFORE touching data, then asks
// the operator to type the Firebase project id (and, for a full tournament
// deletion, the tournament slug).
import type { SeedCandidate } from "./candidates";
import type { ManifestAccount } from "./manifest";

export interface PlayersPlan {
  readonly projectId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly tournamentId: string;
  readonly ownerTag: string;
  readonly ownerUid: string;
  readonly capacity: number;
  readonly currentRegistered: number;
  readonly currentTestRegistered: number;
  readonly targetTestRegistered: number;
  readonly reuseAccounts: readonly Pick<ManifestAccount, "gamerTag" | "email">[];
  readonly createCandidates: readonly SeedCandidate[];
  readonly warnings: readonly string[];
}

export interface CleanupPlanTournament {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly ownerTag: string;
  readonly ownerUid: string;
  readonly status: string;
  readonly registrationCount: number;
  readonly testUids: readonly string[];
  readonly action: "remove-registrations" | "delete-tournament" | "skip-advanced";
  readonly skipReason?: string;
}

export interface CleanupPlan {
  readonly projectId: string;
  readonly tournaments: readonly CleanupPlanTournament[];
  readonly accountsToDelete: readonly ManifestAccount[];
  readonly accountsToKeep: readonly {
    readonly account: ManifestAccount;
    readonly reason: string;
  }[];
  readonly warnings: readonly string[];
}

function bulletList(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.map((value) => `  - ${value}`).join("\n") : `  ${empty}`;
}

export function formatPlayersPlan(plan: PlayersPlan): string {
  const lines = [
    "SEED PLAN (no writes yet)",
    "",
    `Firebase project:    ${plan.projectId}`,
    `Tournament:          ${plan.tournamentName} (${plan.tournamentSlug})`,
    `Tournament id:       ${plan.tournamentId}`,
    `Owner:               ${plan.ownerTag} (${plan.ownerUid})`,
    `Capacity:            ${plan.capacity}`,
    `Current registered:  ${plan.currentRegistered} / ${plan.capacity}`,
    `Test registered:     ${plan.currentTestRegistered}`,
    `Target test players: ${plan.targetTestRegistered}`,
    "",
    "Writes:",
    `  - Reuse manifest accounts:  ${plan.reuseAccounts.length}`,
    `  - Create new accounts:      ${plan.createCandidates.length}`,
    `  - Add registrations:        ${plan.reuseAccounts.length + plan.createCandidates.length}`,
    `  - Resulting field:          ${plan.currentRegistered + plan.reuseAccounts.length + plan.createCandidates.length} / ${plan.capacity}`,
  ];

  if (plan.createCandidates.length > 0) {
    lines.push(
      "",
      "Candidates to create:",
      bulletList(
        plan.createCandidates.map(
          (candidate) =>
            `${candidate.gamerTag} (${candidate.fullName}, ${candidate.country}, ${candidate.platform})`,
        ),
        "none",
      ),
    );
  }

  if (plan.warnings.length > 0) {
    lines.push("", "Warnings:", bulletList(plan.warnings, "none"));
  }

  return lines.join("\n");
}

export function formatCleanupPlan(plan: CleanupPlan): string {
  const lines = ["CLEANUP PLAN (no writes yet)", "", `Firebase project: ${plan.projectId}`, ""];

  if (plan.tournaments.length === 0) {
    lines.push("No test registrations were found in any tournament.");
  }

  for (const tournament of plan.tournaments) {
    lines.push(
      `Tournament:       ${tournament.name} (${tournament.slug})`,
      `Tournament id:    ${tournament.id}`,
      `Owner:            ${tournament.ownerTag} (${tournament.ownerUid})`,
      `Status / count:   ${tournament.status} / ${tournament.registrationCount}`,
      `Action:           ${tournament.action}`,
      `Test accounts:    ${tournament.testUids.length}`,
    );

    if (tournament.action === "delete-tournament") {
      lines.push(
        "",
        "!! WARNING: the ENTIRE tournament, its slug reservation and ALL its",
        "!! subcollections (registrations, draw, fixtures, matches, standings,",
        "!! announcements) will be recursively deleted.",
        "",
      );
    } else if (tournament.action === "skip-advanced" && tournament.skipReason) {
      lines.push(`Skipped:          ${tournament.skipReason}`);
    }

    lines.push("");
  }

  lines.push(
    `Accounts to delete: ${plan.accountsToDelete.length}`,
    bulletList(
      plan.accountsToDelete.map((account) => `${account.gamerTag} <${account.email}>`),
      "none",
    ),
    "",
    `Accounts to keep:   ${plan.accountsToKeep.length}`,
    bulletList(
      plan.accountsToKeep.map(
        (entry) => `${entry.account.gamerTag} <${entry.account.email}> — ${entry.reason}`,
      ),
      "none",
    ),
  );

  if (plan.warnings.length > 0) {
    lines.push("", "Warnings:", bulletList(plan.warnings, "none"));
  }

  return lines.join("\n");
}
