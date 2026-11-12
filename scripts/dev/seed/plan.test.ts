// GCC - unit tests for the seeder's write plans.
import { describe, expect, it } from "vitest";

import { SEED_CANDIDATES } from "./candidates";
import { formatCleanupPlan, formatPlayersPlan, type CleanupPlan, type PlayersPlan } from "./plan";

const playersPlan: PlayersPlan = {
  projectId: "tona-d6f56",
  tournamentName: "Nairobi Invitational",
  tournamentSlug: "nairobi-invitational",
  tournamentId: "tournament-1",
  ownerTag: "Chief",
  ownerUid: "owner-1",
  capacity: 36,
  currentRegistered: 2,
  currentTestRegistered: 0,
  targetTestRegistered: 34,
  reuseAccounts: [],
  createCandidates: SEED_CANDIDATES.slice(0, 2),
  warnings: ["one account was skipped"],
};

const cleanupPlan: CleanupPlan = {
  projectId: "tona-d6f56",
  tournaments: [
    {
      id: "tournament-1",
      slug: "nairobi-invitational",
      name: "Nairobi Invitational",
      ownerTag: "Chief",
      ownerUid: "owner-1",
      status: "registration_open",
      registrationCount: 36,
      testUids: ["uid-1", "uid-2"],
      action: "remove-registrations",
    },
    {
      id: "tournament-2",
      slug: "advanced-cup",
      name: "Advanced Cup",
      ownerTag: "Chief",
      ownerUid: "owner-1",
      status: "league_phase",
      registrationCount: 36,
      testUids: ["uid-3"],
      action: "skip-advanced",
      skipReason: "status is league_phase",
    },
  ],
  accountsToDelete: [
    {
      uid: "uid-1",
      gamerTag: "Ace",
      email: "testplayer01@gcc-test.example",
      password: "batch-password-123",
      slot: 1,
    },
  ],
  accountsToKeep: [],
  warnings: [],
};

describe("players plan", () => {
  it("shows the project, tournament, owner and every write count", () => {
    const output = formatPlayersPlan(playersPlan);

    expect(output).toContain("tona-d6f56");
    expect(output).toContain("Nairobi Invitational (nairobi-invitational)");
    expect(output).toContain("Chief (owner-1)");
    expect(output).toContain("2 / 36");
    expect(output).toContain("Create new accounts:      2");
    expect(output).toContain("Resulting field:          4 / 36");
    expect(output).toContain("one account was skipped");
    expect(output).toContain(SEED_CANDIDATES[0]!.gamerTag);
  });

  it("never prints a password", () => {
    expect(formatPlayersPlan(playersPlan)).not.toContain("batch-password-123");
  });
});

describe("cleanup plan", () => {
  it("separates removals, deletions and advanced tournaments that are kept", () => {
    const output = formatCleanupPlan(cleanupPlan);

    expect(output).toContain("tona-d6f56");
    expect(output).toContain("remove-registrations");
    expect(output).toContain("skip-advanced");
    expect(output).toContain("status is league_phase");
    expect(output).toContain("Accounts to delete: 1");
    expect(output).toContain("Ace <testplayer01@gcc-test.example>");
  });

  it("prints an explicit warning before a whole-tournament deletion", () => {
    const output = formatCleanupPlan({
      ...cleanupPlan,
      tournaments: [
        {
          ...cleanupPlan.tournaments[0]!,
          action: "delete-tournament",
        },
      ],
    });

    expect(output).toContain("ENTIRE tournament");
    expect(output).toContain("recursively deleted");
  });

  it("never prints a password", () => {
    expect(formatCleanupPlan(cleanupPlan)).not.toContain("batch-password-123");
  });
});
