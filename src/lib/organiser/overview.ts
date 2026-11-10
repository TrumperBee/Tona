// GCC - organiser dashboard overview.
//
// One equality-only query loads every tournament the organiser owns (slot
// limits keep this set small); all dashboard figures are then computed from
// real documents. Nothing here is estimated or mocked.
import "server-only";

import { describeAuditAction } from "@/lib/audit/actions";
import type { SessionUser } from "@/lib/auth/session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { getOrganiserTournaments, type OrganiserTournamentRow } from "@/lib/organiser/tournaments";
import { getPlatformSettings } from "@/lib/platform/settings";
import { TOURNAMENT_STATUSES, type TournamentStatus } from "@/types/domain";

/**
 * A tournament occupies an active slot from open registration through the
 * knockout. Drafts, suspended competitions and terminal records do not count.
 */
export const ACTIVE_SLOT_STATUSES: readonly TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "pots_confirmed",
  "fixtures_published",
  "league_phase",
  "knockout",
];

export type OrganiserAttentionKind =
  "closing-soon" | "full-open" | "full-unconfirmed" | "suspended";

export interface OrganiserAttentionItem {
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly kind: OrganiserAttentionKind;
  readonly message: string;
}

export interface OrganiserAuditRow {
  readonly id: string;
  readonly action: string;
  readonly label: string;
  readonly tournamentId: string | null;
  readonly tournamentName: string | null;
  readonly createdAt: Date | null;
}

export interface OrganiserOverview {
  readonly statusCounts: Readonly<Record<TournamentStatus, number>>;
  readonly totalTournaments: number;
  readonly totalRegistrations: number;
  readonly activeSlots: number;
  readonly maxActiveSlots: number;
  readonly exemptFromSlotLimit: boolean;
  readonly attention: readonly OrganiserAttentionItem[];
  readonly recentAudit: readonly OrganiserAuditRow[];
}

const CLOSING_SOON_MS = 48 * 60 * 60 * 1000;
const AUDIT_PAGE_SIZE = 6;
const AUDIT_ID_LIMIT = 10;

function attentionItems(
  tournaments: readonly OrganiserTournamentRow[],
  now: Date,
): readonly OrganiserAttentionItem[] {
  const items: OrganiserAttentionItem[] = [];

  for (const tournament of tournaments) {
    const full = tournament.registrationCount >= tournament.maxParticipants;

    if (tournament.status === "registration_open") {
      const closesIn = tournament.registrationClosesAt
        ? tournament.registrationClosesAt.getTime() - now.getTime()
        : null;

      if (closesIn !== null && closesIn <= CLOSING_SOON_MS) {
        items.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          kind: "closing-soon",
          message:
            closesIn <= 0
              ? "The registration window has passed but registration is still open."
              : `Registration closes in less than 48 hours (${tournament.registrationCount} / ${tournament.maxParticipants} registered).`,
        });
      }

      if (full) {
        items.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          kind: "full-open",
          message: `The field is full (${tournament.registrationCount} / ${tournament.maxParticipants}) but registration is still open.`,
        });
      }
    }

    if (tournament.status === "registration_closed" && full) {
      items.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        kind: "full-unconfirmed",
        message: `The field is full (${tournament.registrationCount} / ${tournament.maxParticipants}) but the pots are not confirmed.`,
      });
    }

    if (tournament.status === "suspended") {
      items.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        kind: "suspended",
        message: "This competition is suspended pending a platform review.",
      });
    }
  }

  return items;
}

async function recentAuditFor(
  tournamentIds: readonly string[],
  namesById: ReadonlyMap<string, string>,
): Promise<readonly OrganiserAuditRow[]> {
  if (tournamentIds.length === 0) {
    return [];
  }

  try {
    // Firestore `in` accepts at most ten values; the most recently updated
    // tournaments are checked first, which matches what the dashboard shows.
    const ids = tournamentIds.slice(0, AUDIT_ID_LIMIT);
    const snapshot = await getFirebaseAdminFirestore()
      .collection(paths.auditLogs())
      .where("tournamentId", "in", ids)
      .orderBy("createdAt", "desc")
      .limit(AUDIT_PAGE_SIZE)
      .get();

    return snapshot.docs.map((document) => {
      const data = document.data() as {
        action?: unknown;
        tournamentId?: unknown;
        createdAt?: { toDate?: () => Date };
      };
      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate()
          : null;

      return {
        id: document.id,
        action: typeof data.action === "string" ? data.action : "unknown",
        label: describeAuditAction(typeof data.action === "string" ? data.action : "unknown"),
        tournamentId: typeof data.tournamentId === "string" ? data.tournamentId : null,
        tournamentName:
          typeof data.tournamentId === "string" ? (namesById.get(data.tournamentId) ?? null) : null,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
      };
    });
  } catch {
    return [];
  }
}

/** Builds the full dashboard overview for one organiser. */
export async function getOrganiserOverview(user: SessionUser): Promise<OrganiserOverview> {
  const [tournaments, settings] = await Promise.all([
    getOrganiserTournaments(user.userId),
    getPlatformSettings(),
  ]);

  const statusCounts = Object.fromEntries(
    TOURNAMENT_STATUSES.map((status) => [status, 0]),
  ) as Record<TournamentStatus, number>;

  let totalRegistrations = 0;
  let activeSlots = 0;

  for (const tournament of tournaments) {
    statusCounts[tournament.status] += 1;
    totalRegistrations += tournament.registrationCount;

    if (ACTIVE_SLOT_STATUSES.includes(tournament.status)) {
      activeSlots += 1;
    }
  }

  const recentAudit = await recentAuditFor(
    tournaments.map((tournament) => tournament.id),
    new Map(tournaments.map((tournament) => [tournament.id, tournament.name])),
  );

  return {
    statusCounts,
    totalTournaments: tournaments.length,
    totalRegistrations,
    activeSlots,
    maxActiveSlots: settings.maxActiveTournamentsPerOrganiser,
    exemptFromSlotLimit: user.isSuperAdmin,
    attention: attentionItems(tournaments, new Date()),
    recentAudit,
  };
}
