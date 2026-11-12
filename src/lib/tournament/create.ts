// GCC - tournament draft creation.
//
// `POST /api/organiser/tournaments` backs this. The slot limit from the
// platform settings and the immutable slug reservation are enforced inside ONE
// Firestore transaction, so a burst of creates can neither exceed the limit
// nor claim the same slug. Everything the document needs (owner snapshots,
// format, capacity) is derived on the server; the client supplies only the
// basics from wizard step 1.
import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import { DEFAULT_MATCH_DURATION_MINUTES, UCL_LEAGUE_PHASE_36 } from "@/lib/config/formats";
import { DEFAULT_TIEBREAKER_PROFILE } from "@/lib/engine/standings/types";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { ACTIVE_SLOT_STATUSES } from "@/lib/organiser/overview";
import { getPlatformSettings } from "@/lib/platform/settings";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { slugCandidates, suggestTournamentSlug } from "@/lib/utils/slug";
import type { TournamentBasicsInput } from "@/lib/validation/tournament";

const MAX_SLUG_CANDIDATES = 12;

/**
 * Reserves a unique slug for a new tournament inside the transaction. The
 * first free candidate wins; concurrent transactions that read the same free
 * slug contend on `transaction.create` and retry with the next candidate.
 */
async function reserveSlug(
  transaction: Transaction,
  firestore: ReturnType<typeof getFirebaseAdminFirestore>,
  name: string,
  season: string,
  tournamentId: string,
): Promise<string> {
  const candidates = slugCandidates(suggestTournamentSlug(name, season), MAX_SLUG_CANDIDATES);

  for (const candidate of candidates) {
    const snapshot = await transaction.get(firestore.doc(paths.tournamentSlug(candidate)));

    if (!snapshot.exists) {
      transaction.create(firestore.doc(paths.tournamentSlug(candidate)), {
        tournamentId,
        name,
        createdAt: FieldValue.serverTimestamp(),
      });

      return candidate;
    }
  }

  throw new TournamentMutationError(
    "Too many tournaments already use this name and season. Pick a different name.",
    409,
  );
}

export interface CreatedTournament {
  readonly tournamentId: string;
  readonly slug: string;
}

/**
 * Creates a draft tournament for the signed-in organiser (or Super Admin, who
 * is exempt from the slot limit and becomes the owner).
 */
export async function createTournamentDraft(
  user: SessionUser,
  input: TournamentBasicsInput,
): Promise<CreatedTournament> {
  const firestore = getFirebaseAdminFirestore();
  const settings = await getPlatformSettings();

  // Owner snapshots are copied once, here, so public surfaces never need to
  // join against private documents later.
  const userSnapshot = await firestore.doc(paths.user(user.userId)).get();
  const ownerTag =
    typeof userSnapshot.data()?.gamerTag === "string" ? userSnapshot.data()?.gamerTag : "";
  const organiserSnapshot = await firestore.doc(paths.organiserProfile(user.userId)).get();
  const organisationName =
    typeof organiserSnapshot.data()?.organisationName === "string"
      ? (organiserSnapshot.data()?.organisationName as string)
      : "";

  const tournamentId = firestore.collection(paths.tournaments()).doc().id;

  const created = await firestore.runTransaction<CreatedTournament>(async (transaction) => {
    if (!user.isSuperAdmin) {
      // Re-counted inside the transaction so concurrent creations cannot slip
      // past the limit.
      const activeSlots = await transaction.get(
        firestore
          .collection(paths.tournaments())
          .where("ownerUid", "==", user.userId)
          .where("status", "in", [...ACTIVE_SLOT_STATUSES]),
      );

      if (activeSlots.size >= settings.maxActiveTournamentsPerOrganiser) {
        throw new TournamentMutationError(
          `You already have ${activeSlots.size} active competitions and the platform allows ` +
            `${settings.maxActiveTournamentsPerOrganiser}. Finish or cancel one before creating another.`,
          409,
        );
      }
    }

    const slug = await reserveSlug(transaction, firestore, input.name, input.season, tournamentId);
    const reference = firestore.doc(paths.tournament(tournamentId));

    transaction.set(reference, {
      ownerUid: user.userId,
      ownerTag,
      organisationName,
      slug,
      name: input.name,
      nameLower: input.name.toLowerCase(),
      description: input.description,
      gameId: input.gameId,
      formatId: UCL_LEAGUE_PHASE_36.id,
      coverImageUrl: null,
      coverImagePublicId: null,
      logoUrl: null,
      logoPublicId: null,
      rules: "",
      matchDurationMinutes: DEFAULT_MATCH_DURATION_MINUTES,
      timezone: "Africa/Nairobi",
      registrationOpensAt: null,
      registrationClosesAt: null,
      startsAt: null,
      maxParticipants: UCL_LEAGUE_PHASE_36.participants,
      registrationCount: 0,
      status: "draft",
      suspendedFrom: null,
      season: input.season,
      allowedPlatforms: null,
      allowedCountries: null,
      tiebreakerProfile: DEFAULT_TIEBREAKER_PROFILE,
      standingsUpdatedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournamentId, slug };
  });

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "tournament.created",
    targetType: "tournament",
    targetId: created.tournamentId,
    tournamentId: created.tournamentId,
    before: null,
    after: {
      name: input.name,
      season: input.season,
      gameId: input.gameId,
      slug: created.slug,
      status: "draft",
    },
  });

  return created;
}
