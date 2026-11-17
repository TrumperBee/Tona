// GCC - player-to-opponent WhatsApp contact.
//
// The privacy rule for this module: a wa.me link always contains the
// recipient's number, so the number is never stored in a public document and
// never rendered as text. It leaves the server only inside a link, in response
// to an authorised request from one of the two players of a scheduled match,
// and only after that request has passed the route's same-origin check and
// rate limit. Every issuance writes a `contactEvents` record and an audit
// entry, so abuse can be traced without anybody re-reading the number.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import {
  buildMatchContactMessage,
  clampContactMessage,
  matchContactLabel,
  normaliseContactNote,
  selectMatchContactTemplate,
  type MatchContactTemplateId,
} from "@/lib/contact/message";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import { isValidE164, normalizePhone } from "@/lib/whatsapp/phone";
import type { ContactEventDocument, MatchDocument, TournamentDocument } from "@/types/domain";

export const CONTACT_RATE_LIMIT = 30;
export const CONTACT_RATE_WINDOW_SECONDS = 3600;

export interface MatchContactPreview {
  readonly available: true;
  readonly templateId: MatchContactTemplateId;
  readonly message: string;
  readonly contactNote: string | null;
  readonly opponentTag: string;
}

export interface MatchContactUnavailable {
  readonly available: false;
  /** Neutral, non-enumerating reason shown under the disabled button. */
  readonly reason: string;
}

export type MatchContactAvailability = MatchContactPreview | MatchContactUnavailable;

interface LoadedMatch {
  readonly tournament: TournamentDocument;
  readonly match: MatchDocument;
  readonly tournamentId: string;
  readonly matchId: string;
  readonly opponentUid: string;
  readonly opponentTag: string;
}

function unavailable(reason: string): MatchContactUnavailable {
  return { available: false, reason };
}

/**
 * Loads the tournament and match and checks every rule except the recipient's
 * account state. Shared by the preview and the link issuance so the two can
 * never disagree about whether contact is possible.
 */
async function loadContactContext(
  tournamentId: string,
  matchId: string,
  user: SessionUser,
): Promise<LoadedMatch> {
  const firestore = getFirebaseAdminFirestore();
  const [tournamentSnapshot, matchSnapshot] = await Promise.all([
    firestore.doc(paths.tournament(tournamentId)).get(),
    firestore.doc(paths.tournamentMatch(tournamentId, matchId)).get(),
  ]);

  if (!tournamentSnapshot.exists || !matchSnapshot.exists) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as TournamentDocument;
  const match = matchSnapshot.data() as MatchDocument;

  if (match.tournamentId !== tournamentId) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  if (!isFixturesPublicStatus(tournament.status)) {
    throw new TournamentMutationError("This match is not public yet.", 409);
  }

  if (!Array.isArray(match.participants) || !match.participants.includes(user.userId)) {
    throw new TournamentMutationError(
      "Only the two players in this match can contact each other.",
      403,
    );
  }

  if (match.status !== "scheduled") {
    throw new TournamentMutationError(
      "Contact is only available before the result is recorded.",
      409,
    );
  }

  const [homeUid, awayUid] = match.participants;
  const opponentUid = homeUid === user.userId ? awayUid : homeUid;

  // A knockout match exists as soon as its tie is created; an undecided side
  // is stored as an empty uid. Contact needs both players to be real.
  if (typeof opponentUid !== "string" || opponentUid.length === 0) {
    throw new TournamentMutationError(
      "Your opponent has not been decided yet, so there is nobody to contact.",
      409,
    );
  }

  return {
    tournament,
    match,
    tournamentId,
    matchId,
    opponentUid,
    opponentTag: homeUid === user.userId ? match.awayTag : match.homeTag,
  };
}

function suggestedMessage(
  context: LoadedMatch,
  senderTag: string,
  variant?: MatchContactTemplateId,
): MatchContactPreview {
  const templateId =
    variant ??
    selectMatchContactTemplate({
      stage: context.match.stage,
      leg: context.match.leg ?? null,
      tieId: context.match.tieId ?? null,
    });

  return {
    available: true,
    templateId,
    message: buildMatchContactMessage(templateId, {
      opponentTag: context.opponentTag,
      senderTag,
      tournamentName: context.tournament.name,
      matchLabel: matchContactLabel(context.match),
      contactNote: context.tournament.contactNote ?? null,
    }),
    contactNote: normaliseContactNote(context.tournament.contactNote ?? null),
    opponentTag: context.opponentTag,
  };
}

async function requireActiveOpponent(
  opponentUid: string,
): Promise<{ readonly phone: string; readonly gamerTag: string }> {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.doc(paths.user(opponentUid)).get();

  if (!snapshot.exists) {
    throw new TournamentMutationError("That player is no longer available.", 409);
  }

  const data = snapshot.data() ?? {};

  if (data.status !== "active") {
    throw new TournamentMutationError("That player's account cannot be contacted right now.", 409);
  }

  const phone = typeof data.whatsappE164 === "string" ? normalizePhone(data.whatsappE164) : "";

  if (!phone || !isValidE164(phone)) {
    throw new TournamentMutationError(
      "That player has not added a WhatsApp number, so contact is unavailable.",
      409,
    );
  }

  return {
    phone,
    gamerTag: typeof data.gamerTag === "string" ? data.gamerTag : "your opponent",
  };
}

/**
 * Returns the suggested message for the bottom sheet. No link, no number and
 * no side effect: the number only moves when the player commits to sending.
 */
export async function getMatchContactPreview(
  tournamentId: string,
  matchId: string,
  user: SessionUser,
): Promise<MatchContactAvailability> {
  const context = await loadContactContext(tournamentId, matchId, user);

  try {
    await requireActiveOpponent(context.opponentUid);
  } catch (error) {
    if (error instanceof TournamentMutationError) {
      return unavailable(error.message);
    }

    throw error;
  }

  const senderSnapshot = await getFirebaseAdminFirestore().doc(paths.user(user.userId)).get();
  const senderTag =
    typeof senderSnapshot.data()?.gamerTag === "string"
      ? (senderSnapshot.data()?.gamerTag as string)
      : "a GCC player";

  return suggestedMessage(context, senderTag);
}

/**
 * Builds the wa.me link from the other player's stored number. Either the
 * template suggestion (default) or the player's edited text (max 500 chars) is
 * used. The issuance is recorded in `contactEvents` and the audit log.
 */
export async function issueMatchContactLink(
  tournamentId: string,
  matchId: string,
  user: SessionUser,
  options: { readonly message?: string; readonly variant?: MatchContactTemplateId } = {},
): Promise<{ readonly link: string }> {
  const context = await loadContactContext(tournamentId, matchId, user);
  const opponent = await requireActiveOpponent(context.opponentUid);
  const senderSnapshot = await getFirebaseAdminFirestore().doc(paths.user(user.userId)).get();
  const senderTag =
    typeof senderSnapshot.data()?.gamerTag === "string"
      ? (senderSnapshot.data()?.gamerTag as string)
      : "a GCC player";

  const suggestion = suggestedMessage(context, senderTag, options.variant);
  const edited = typeof options.message === "string" ? clampContactMessage(options.message) : "";
  const message = edited.length > 0 ? edited : suggestion.message;
  const templateId = edited.length > 0 ? null : suggestion.templateId;

  let link: string;

  try {
    link = buildWhatsAppLink(opponent.phone, message);
  } catch {
    throw new TournamentMutationError("That player's WhatsApp number is not usable.", 409);
  }

  const firestore = getFirebaseAdminFirestore();
  // The domain type describes client-SDK timestamps; the Admin SDK writes the
  // structurally compatible server timestamp.
  const event: Omit<ContactEventDocument, "createdAt"> & { readonly createdAt: Timestamp } = {
    tournamentId,
    matchId,
    fromUid: user.userId,
    toUid: context.opponentUid,
    templateId,
    createdAt: Timestamp.now(),
  };

  await firestore.collection(paths.contactEvents()).add(event);

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "match.contact_link_issued",
    targetType: "match",
    targetId: matchId,
    tournamentId,
    before: null,
    after: { toTag: opponent.gamerTag, edited: templateId === null },
  });

  return { link };
}
