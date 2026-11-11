// GCC - tournament cover and logo reference storage.
//
// The upload routes validate bytes and push them to Cloudinary with server
// credentials; this module persists the resulting reference on the tournament
// document. The editable-fields matrix applies like any other patch, the write
// happens inside a transaction against a fresh read, and every change is
// audited. Replacing an image destroys the previous Cloudinary asset
// best-effort after the commit so old URLs never dangle.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { destroyAvatar } from "@/lib/profile/cloudinary";
import { filterTournamentPatch } from "@/lib/tournament/editable-fields";
import { TournamentMutationError } from "@/lib/tournament/errors";
import type { TournamentDocument } from "@/types/domain";

export type TournamentImageKind = "cover" | "logo";

interface ImageFields {
  readonly urlField: "coverImageUrl" | "logoUrl";
  readonly publicIdField: "coverImagePublicId" | "logoPublicId";
}

const FIELD_MAP: Readonly<Record<TournamentImageKind, ImageFields>> = {
  cover: { urlField: "coverImageUrl", publicIdField: "coverImagePublicId" },
  logo: { urlField: "logoUrl", publicIdField: "logoPublicId" },
};

/**
 * Stores a freshly uploaded image reference on the tournament. `stored` comes
 * from the platform's own Cloudinary upload, never from client input.
 */
export async function storeTournamentImage(
  tournamentId: string,
  kind: TournamentImageKind,
  stored: { readonly url: string; readonly publicId: string },
): Promise<void> {
  const fields = FIELD_MAP[kind];
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const result = await firestore.runTransaction<{
    before: string | null;
    previousPublicId: string | null;
  }>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = snapshot.data() as TournamentDocument;
    const filter = filterTournamentPatch(tournament, { [fields.urlField]: stored.url });

    if (!filter.ok) {
      throw new TournamentMutationError(
        "This competition's images can no longer be changed.",
        403,
        { [fields.urlField]: "This field is locked." },
      );
    }

    const before = tournament[fields.urlField] ?? null;
    const previousPublicId = tournament[fields.publicIdField] ?? null;

    transaction.update(reference, {
      [fields.urlField]: stored.url,
      [fields.publicIdField]: stored.publicId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { before, previousPublicId };
  });

  if (result.previousPublicId) {
    await destroyAvatar(result.previousPublicId).catch(() => undefined);
  }

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.updated",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { [fields.urlField]: result.before },
    after: { [fields.urlField]: stored.url },
  });
}
