// GCC - organiser registration management.
//
// Read helpers for the registrations tab plus the two privileged read paths:
// the WhatsApp contact link (issued for one player, audited, the raw number is
// never returned to the browser) and the CSV export (owner only, display-safe
// columns only — no phone numbers, no email addresses).
import "server-only";

import type { Query } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { parsePageSize } from "@/lib/super-admin/query";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import { renderWhatsAppTemplate } from "@/lib/whatsapp/templates";
import type { RegistrationDocument, RegistrationStatus, TournamentDocument } from "@/types/domain";

export interface OrganiserRegistrationRow {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly platform: string;
  readonly avatarUrl: string | null;
  readonly status: RegistrationStatus;
  readonly registeredAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly removedAt: Date | null;
}

export interface RegistrationListOptions {
  readonly status?: RegistrationStatus | null;
  readonly search?: string | null;
  readonly after?: string | null;
  readonly pageSize?: number;
}

export interface RegistrationListResult {
  readonly rows: readonly OrganiserRegistrationRow[];
  readonly counts: Readonly<Record<RegistrationStatus, number>>;
  readonly hasMore: boolean;
  readonly lastId: string | null;
}

function toRow(id: string, data: RegistrationDocument): OrganiserRegistrationRow {
  return {
    uid: id,
    gamerTag: data.gamerTag ?? "",
    country: data.country ?? "",
    platform: data.platform ?? "",
    avatarUrl: data.avatarUrl ?? null,
    status: data.status ?? "registered",
    registeredAt: data.registeredAt?.toDate?.() ?? null,
    withdrawnAt: data.withdrawnAt?.toDate?.() ?? null,
    removedAt: data.removedAt?.toDate?.() ?? null,
  };
}

/**
 * One page of registrations for the organiser view. New entries first unless a
 * gamer-tag search is active (then alphabetical). Counts are exact Firestore
 * aggregates for all three states. Never throws; failures degrade to an empty
 * page.
 */
export async function listTournamentRegistrations(
  tournamentId: string,
  options: RegistrationListOptions = {},
): Promise<RegistrationListResult> {
  const empty: RegistrationListResult = {
    rows: [],
    counts: { registered: 0, withdrawn: 0, removed: 0 },
    hasMore: false,
    lastId: null,
  };

  try {
    const firestore = getFirebaseAdminFirestore();
    const collection = firestore.collection(paths.tournamentRegistrations(tournamentId));
    const pageSize = parsePageSize(String(options.pageSize ?? ""));
    const term = (options.search ?? "").trim().toLowerCase().slice(0, 60);

    let query: Query = collection;

    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    if (term.length > 0) {
      query = query
        .where("gamerTagLower", ">=", term)
        .where("gamerTagLower", "<=", `${term}\uf8ff`)
        .orderBy("gamerTagLower", "asc");
    } else {
      query = query.orderBy("registeredAt", "desc");
    }

    if (options.after) {
      const cursor = await firestore
        .doc(paths.tournamentRegistration(tournamentId, options.after))
        .get();

      if (!cursor.exists) {
        return empty;
      }

      query = query.startAfter(cursor);
    }

    const [snapshot, registered, withdrawn, removed] = await Promise.all([
      query.limit(pageSize + 1).get(),
      collection.where("status", "==", "registered").count().get(),
      collection.where("status", "==", "withdrawn").count().get(),
      collection.where("status", "==", "removed").count().get(),
    ]);
    const docs = snapshot.docs.slice(0, pageSize);

    return {
      rows: docs.map((document) => toRow(document.id, document.data() as RegistrationDocument)),
      counts: {
        registered: registered.data().count,
        withdrawn: withdrawn.data().count,
        removed: removed.data().count,
      },
      hasMore: snapshot.docs.length > pageSize,
      lastId: docs[docs.length - 1]?.id ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Issues a one-player WhatsApp click-to-chat link. The message is the generic
 * organiser-contact template; the player's phone number is used to build the
 * link and is never returned to the browser. Every issuance is audited.
 */
export async function issueRegistrationContactLink(
  tournamentId: string,
  playerUid: string,
): Promise<{ readonly link: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentSnapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as Partial<TournamentDocument> | undefined;
  const userSnapshot = await firestore.doc(paths.user(playerUid)).get();
  const phone = userSnapshot.data()?.whatsappE164;

  if (typeof phone !== "string" || phone.trim().length === 0) {
    throw new TournamentMutationError(
      "That player has no WhatsApp number on file. They can add one from their profile.",
      409,
    );
  }

  const registrationSnapshot = await firestore
    .doc(paths.tournamentRegistration(tournamentId, playerUid))
    .get();

  if (!registrationSnapshot.exists) {
    throw new TournamentMutationError("That player is not registered for this competition.", 404);
  }

  const link = buildWhatsAppLink(
    phone,
    renderWhatsAppTemplate("organiser-contact", {
      tournamentName: typeof tournament?.name === "string" ? tournament.name : "this competition",
    }),
  );

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.contact_link_issued",
    targetType: "registration",
    targetId: playerUid,
    tournamentId,
    before: null,
    after: { gamerTag: registrationSnapshot.data()?.gamerTag ?? null },
  });

  return { link };
}

/** Escapes one CSV cell. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

/**
 * Exports the current registered field as CSV: gamer tag, full name, country,
 * platform and entry time. Owner only — full names come from the private user
 * documents. No phone numbers or email addresses are ever included.
 */
export async function exportTournamentRegistrationsCsv(
  tournamentId: string,
): Promise<{ readonly filename: string; readonly csv: string }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentSnapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as Partial<TournamentDocument> | undefined;

  if (access.user.userId !== tournament?.ownerUid) {
    // Owner only: a Super Admin may manage a competition but not export its
    // player list.
    throw new TournamentMutationError(
      "Only the competition owner can export the player list.",
      403,
    );
  }

  const registrations = await firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered")
    .orderBy("registeredAt", "asc")
    .get();

  const userSnapshots = await firestore.getAll(
    ...registrations.docs.map((document) => firestore.doc(paths.user(document.id))),
  );
  const fullNames = new Map(
    userSnapshots.map((snapshot) => [
      snapshot.id,
      typeof snapshot.data()?.fullName === "string" ? (snapshot.data()?.fullName as string) : "",
    ]),
  );

  const header = "gamerTag,fullName,country,platform,registeredAt";
  const lines = registrations.docs.map((document) => {
    const data = document.data();
    const registeredAt = data.registeredAt?.toDate?.();

    return [
      csvCell(typeof data.gamerTag === "string" ? data.gamerTag : ""),
      csvCell(fullNames.get(document.id) ?? ""),
      csvCell(typeof data.country === "string" ? data.country : ""),
      csvCell(typeof data.platform === "string" ? data.platform : ""),
      registeredAt ? registeredAt.toISOString() : "",
    ].join(",");
  });

  const slug = typeof tournament?.slug === "string" ? tournament.slug : tournamentId;

  return {
    filename: `${slug}-registrations.csv`,
    csv: [header, ...lines].join("\r\n"),
  };
}
