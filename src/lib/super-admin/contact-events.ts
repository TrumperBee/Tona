// GCC - Super Admin view of WhatsApp contact issuances for one account.
//
// Server-only. `contactEvents` never contains a phone number or a message body:
// it records who contacted whom, about which match, and when. The console shows
// it so abuse can be investigated without ever reading a number.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { ContactEventDocument } from "@/types/domain";

export const CONTACT_EVENT_LIST_SIZE = 20;

export interface ContactEventRow {
  readonly id: string;
  readonly tournamentId: string;
  readonly matchId: string;
  readonly fromUid: string;
  readonly toUid: string;
  readonly templateId: string | null;
  readonly createdAt: string | null;
  /** True when this account sent the message. */
  readonly outgoing: boolean;
}

function toIsoString(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function toRow(id: string, data: ContactEventDocument, uid: string): ContactEventRow {
  return {
    id,
    tournamentId: typeof data.tournamentId === "string" ? data.tournamentId : "",
    matchId: typeof data.matchId === "string" ? data.matchId : "",
    fromUid: typeof data.fromUid === "string" ? data.fromUid : "",
    toUid: typeof data.toUid === "string" ? data.toUid : "",
    templateId: typeof data.templateId === "string" ? data.templateId : null,
    createdAt: toIsoString(data.createdAt),
    outgoing: data.fromUid === uid,
  };
}

/**
 * Latest contact issuances where this account is the sender or the recipient.
 * Two bounded queries are merged in memory because Firestore cannot OR across
 * two equality filters on different fields.
 */
export async function listContactEventsForUser(uid: string): Promise<readonly ContactEventRow[]> {
  try {
    const firestore = getFirebaseAdminFirestore();
    const collection = firestore.collection(paths.contactEvents());
    const [sent, received] = await Promise.all([
      collection
        .where("fromUid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(CONTACT_EVENT_LIST_SIZE)
        .get(),
      collection
        .where("toUid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(CONTACT_EVENT_LIST_SIZE)
        .get(),
    ]);

    const rows = [
      ...sent.docs.map((document) =>
        toRow(document.id, document.data() as ContactEventDocument, uid),
      ),
      ...received.docs.map((document) =>
        toRow(document.id, document.data() as ContactEventDocument, uid),
      ),
    ];

    return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  } catch {
    return [];
  }
}
