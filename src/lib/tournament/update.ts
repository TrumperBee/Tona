// GCC - tournament detail updates.
//
// `PATCH /api/organiser/tournaments/[id]` backs this. Ownership is verified by
// the shared guard and the editable-fields matrix is enforced inside a
// transaction against a FRESH read of the document, so a player registering
// while the organiser saves cannot be outrun (for example, renaming a
// competition the moment its first entry lands). Cover and logo images are
// uploaded through the platform's secure upload routes; this patch may only
// clear them.
import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { destroyAvatar } from "@/lib/profile/cloudinary";
import {
  checkRegistrationClosesAtChange,
  filterTournamentPatch,
} from "@/lib/tournament/editable-fields";
import { TournamentMutationError } from "@/lib/tournament/errors";
import type { TournamentDocument } from "@/types/domain";
import {
  normaliseEntryRestrictions,
  validateStartsAtHorizon,
  type TournamentUpdateInput,
} from "@/lib/validation/tournament";

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Only the platform's own upload routes may set image URLs on a tournament. */
function rejectClientImageUrls(patch: TournamentUpdateInput): void {
  if (patch.coverImageUrl !== undefined && patch.coverImageUrl !== null) {
    throw new TournamentMutationError(
      "Cover images are uploaded through the platform, not linked from a URL.",
      400,
      { coverImageUrl: "Upload a cover image file instead." },
    );
  }

  if (patch.logoUrl !== undefined && patch.logoUrl !== null) {
    throw new TournamentMutationError(
      "Logos are uploaded through the platform, not linked from a URL.",
      400,
      { logoUrl: "Upload a logo image file instead." },
    );
  }
}

interface MergedDates {
  readonly opensAt: Date | null;
  readonly closesAt: Date | null;
  readonly startsAt: Date | null;
}

function mergeDates(tournament: TournamentDocument, patch: TournamentUpdateInput): MergedDates {
  return {
    opensAt: patch.registrationOpensAt ?? toDate(tournament.registrationOpensAt),
    closesAt: patch.registrationClosesAt ?? toDate(tournament.registrationClosesAt),
    startsAt: patch.startsAt ?? toDate(tournament.startsAt),
  };
}

/** Order rules across whichever of the three moments are known. */
function validateMergedDates(dates: MergedDates, now: Date): void {
  const fields: Record<string, string> = {};

  if (dates.opensAt && dates.closesAt && dates.opensAt.getTime() >= dates.closesAt.getTime()) {
    fields.registrationClosesAt = "Registration must close after it opens.";
  }

  if (dates.startsAt && dates.closesAt && dates.startsAt.getTime() < dates.closesAt.getTime()) {
    fields.startsAt = "The competition cannot start before registration closes.";
  }

  if (dates.startsAt) {
    const horizon = validateStartsAtHorizon(dates.startsAt, now);

    if (horizon) {
      fields.startsAt = horizon;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new TournamentMutationError("Check the schedule fields.", 400, fields);
  }
}

function storedValue(tournament: TournamentDocument, field: string): unknown {
  const dates: Record<string, unknown> = {
    registrationOpensAt: toDate(tournament.registrationOpensAt)?.toISOString() ?? null,
    registrationClosesAt: toDate(tournament.registrationClosesAt)?.toISOString() ?? null,
    startsAt: toDate(tournament.startsAt)?.toISOString() ?? null,
  };

  if (field in dates) {
    return dates[field];
  }

  return (tournament as unknown as Record<string, unknown>)[field] ?? null;
}

/**
 * Applies a partial update to a tournament owned by the caller (or the Super
 * Admin). Every change is audited with the stored and new values.
 */
export async function updateTournament(
  tournamentId: string,
  patch: TournamentUpdateInput,
): Promise<void> {
  rejectClientImageUrls(patch);

  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const { before, after, clearedAssets } = await firestore.runTransaction<{
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    clearedAssets: string[];
  }>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = snapshot.data() as TournamentDocument;

    // The matrix is re-checked against the fresh document, so a registration
    // that landed between the guard read and this write cannot be bypassed.
    const filter = filterTournamentPatch(tournament, patch);

    if (!filter.ok) {
      throw new TournamentMutationError(
        "Some fields can no longer be changed for this competition.",
        403,
        Object.fromEntries(
          filter.locked.map((field) => [
            field,
            field === "tiebreakerProfile"
              ? "The tie-break profile is locked once the first league result is recorded."
              : "This field is locked.",
          ]),
        ),
      );
    }

    const dates = mergeDates(tournament, patch);
    validateMergedDates(dates, now);

    // After publication the registration deadline only ever moves later.
    if (patch.registrationClosesAt && tournament.status !== "draft") {
      const stored = toDate(tournament.registrationClosesAt);
      const message = stored
        ? checkRegistrationClosesAtChange(stored, patch.registrationClosesAt, now)
        : patch.registrationClosesAt.getTime() <= now.getTime()
          ? "The registration deadline must stay in the future."
          : null;

      if (message) {
        throw new TournamentMutationError(message, 400, { registrationClosesAt: message });
      }
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const clearedAssets: string[] = [];

    const stage = (field: string, next: unknown): void => {
      update[field] = next;
      before[field] = storedValue(tournament, field);
      after[field] = next instanceof Date ? next.toISOString() : next;
    };

    if (patch.name !== undefined) {
      stage("name", patch.name);
      update.nameLower = patch.name.toLowerCase();
    }

    if (patch.season !== undefined) {
      stage("season", patch.season);
    }

    if (patch.gameId !== undefined) {
      stage("gameId", patch.gameId);
    }

    if (patch.description !== undefined) {
      stage("description", patch.description);
    }

    if (patch.rules !== undefined) {
      stage("rules", patch.rules);
    }

    if (patch.timezone !== undefined) {
      stage("timezone", patch.timezone);
    }

    if (patch.matchDurationMinutes !== undefined) {
      stage("matchDurationMinutes", patch.matchDurationMinutes);
    }

    if (patch.registrationOpensAt !== undefined) {
      stage("registrationOpensAt", patch.registrationOpensAt.toISOString());
      update.registrationOpensAt = Timestamp.fromDate(patch.registrationOpensAt);
    }

    if (patch.registrationClosesAt !== undefined) {
      stage("registrationClosesAt", patch.registrationClosesAt.toISOString());
      update.registrationClosesAt = Timestamp.fromDate(patch.registrationClosesAt);
    }

    if (patch.startsAt !== undefined) {
      stage("startsAt", patch.startsAt.toISOString());
      update.startsAt = Timestamp.fromDate(patch.startsAt);
    }

    if (patch.coverImageUrl !== undefined) {
      stage("coverImageUrl", patch.coverImageUrl);
      update.coverImagePublicId =
        patch.coverImageUrl === null ? null : tournament.coverImagePublicId;

      if (patch.coverImageUrl === null && tournament.coverImagePublicId) {
        clearedAssets.push(tournament.coverImagePublicId);
      }
    }

    if (patch.logoUrl !== undefined) {
      stage("logoUrl", patch.logoUrl);
      update.logoPublicId = patch.logoUrl === null ? null : tournament.logoPublicId;

      if (patch.logoUrl === null && tournament.logoPublicId) {
        clearedAssets.push(tournament.logoPublicId);
      }
    }

    if (patch.allowedPlatforms !== undefined || patch.allowedCountries !== undefined) {
      const restrictions = normaliseEntryRestrictions({
        allowedPlatforms: patch.allowedPlatforms ?? tournament.allowedPlatforms,
        allowedCountries: patch.allowedCountries ?? tournament.allowedCountries,
      });

      if (patch.allowedPlatforms !== undefined) {
        stage("allowedPlatforms", restrictions.allowedPlatforms);
      }

      if (patch.allowedCountries !== undefined) {
        stage("allowedCountries", restrictions.allowedCountries);
      }
    }

    if (patch.tiebreakerProfile !== undefined) {
      stage("tiebreakerProfile", patch.tiebreakerProfile);
    }

    transaction.update(reference, update);

    return { before, after, clearedAssets };
  });

  // Remote image cleanup is best-effort and never blocks the saved change.
  await Promise.allSettled(clearedAssets.map((publicId) => destroyAvatar(publicId)));

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.updated",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before,
    after,
  });
}
