// GCC - server-side organiser profile reads and writes.
//
// organiserProfiles/{uid} is public read, server write. It is created
// idempotently when an application is approved or when the organiser first
// enters the organiser area; the owner then edits it through
// PATCH /api/organiser/profile. The uid, logo references and timestamps are
// never accepted from the request body.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { OrganiserProfileLink, PublicProfileDocument } from "@/types/domain";
import type { OrganiserProfileEditInput } from "@/lib/validation/organiser-profile";

export class OrganiserProfileError extends Error {
  readonly code: "not-found" | "name-required";

  constructor(code: "not-found" | "name-required", message: string) {
    super(message);
    this.name = "OrganiserProfileError";
    this.code = code;
  }
}

/** Server view of the public organiser profile with plain Date timestamps. */
export interface OrganiserProfileView {
  readonly uid: string;
  readonly organisationName: string;
  readonly bio: string | null;
  readonly logoUrl: string | null;
  readonly logoPublicId: string | null;
  readonly links: readonly OrganiserProfileLink[];
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

function toDate(value: unknown): Date | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function toView(uid: string, data: Record<string, unknown>): OrganiserProfileView {
  return {
    uid,
    organisationName: typeof data.organisationName === "string" ? data.organisationName.trim() : "",
    bio: typeof data.bio === "string" && data.bio.trim().length > 0 ? data.bio : null,
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    logoPublicId: typeof data.logoPublicId === "string" ? data.logoPublicId : null,
    links: Array.isArray(data.links)
      ? data.links.filter(
          (link): link is OrganiserProfileLink =>
            typeof link === "object" &&
            link !== null &&
            typeof (link as OrganiserProfileLink).label === "string" &&
            typeof (link as OrganiserProfileLink).url === "string",
        )
      : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * Returns the public organiser profile, or null when it does not exist.
 * Never throws: a missing or unreadable profile degrades to an honest empty
 * state on public pages.
 */
export async function getOrganiserProfile(uid: string): Promise<OrganiserProfileView | null> {
  if (uid.trim().length === 0) {
    return null;
  }

  try {
    const snapshot = await getFirebaseAdminFirestore().doc(paths.organiserProfile(uid)).get();

    return snapshot.exists ? toView(uid, snapshot.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the initial organisation name for a first-time organiser: the
 * community name from their latest approved application, falling back to their
 * public gamer tag. Returns null when neither source has a usable name.
 */
async function resolveInitialOrganisationName(uid: string): Promise<string | null> {
  const firestore = getFirebaseAdminFirestore();

  // Equality-only filters merge the automatic indexes, so no composite index
  // is required. A user has few applications; the latest approved one wins.
  const [applications, publicProfile] = await Promise.all([
    firestore
      .collection(paths.adminApplications())
      .where("uid", "==", uid)
      .where("status", "==", "approved")
      .get()
      .catch(() => null),
    firestore
      .doc(paths.publicProfile(uid))
      .get()
      .catch(() => null),
  ]);

  const approved = (applications?.docs ?? [])
    .map((document) => {
      const data = document.data() as { communityName?: unknown; createdAt?: unknown };

      return {
        communityName: typeof data.communityName === "string" ? data.communityName.trim() : "",
        createdAt: toDate(data.createdAt),
      };
    })
    .filter((item) => item.communityName.length >= 2 && item.communityName.length <= 60)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  if (approved.length > 0) {
    return approved[0].communityName;
  }

  if (publicProfile?.exists) {
    const gamerTag = (publicProfile.data() as Partial<PublicProfileDocument>).gamerTag ?? "";

    if (gamerTag.trim().length >= 2 && gamerTag.trim().length <= 60) {
      return gamerTag.trim();
    }
  }

  return null;
}

/**
 * Returns the organiser's profile document, creating it once with a prefilled
 * organisation name when it does not exist yet. Idempotent: concurrent callers
 * converge on one document via a merge write. Returns null only when no honest
 * initial name exists; the settings page then collects one on first save.
 *
 * `prefill` lets the approval path pass the application's community name
 * directly instead of re-querying for it.
 */
export async function ensureOrganiserProfile(
  uid: string,
  prefill?: { readonly organisationName: string },
): Promise<OrganiserProfileView | null> {
  const existing = await getOrganiserProfile(uid);

  if (existing) {
    return existing;
  }

  const prefillName = prefill?.organisationName.trim() ?? "";
  const organisationName =
    prefillName.length >= 2 && prefillName.length <= 60
      ? prefillName
      : await resolveInitialOrganisationName(uid);

  if (!organisationName) {
    return null;
  }

  const now = Timestamp.now();

  await getFirebaseAdminFirestore().doc(paths.organiserProfile(uid)).set(
    {
      uid,
      organisationName,
      bio: null,
      logoUrl: null,
      logoPublicId: null,
      links: [],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return getOrganiserProfile(uid);
}

/**
 * Applies a strict, partial profile edit. `undefined` fields keep their current
 * value, `null` clears them, and the first save creates the document.
 */
export async function updateOrganiserProfile(
  uid: string,
  input: OrganiserProfileEditInput,
): Promise<OrganiserProfileView> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.organiserProfile(uid));

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists
      ? toView(uid, snapshot.data() as Record<string, unknown>)
      : null;

    const organisationName = (input.organisationName ?? current?.organisationName ?? "").trim();

    if (organisationName.length < 2) {
      throw new OrganiserProfileError("name-required", "Enter your organisation's name.");
    }

    const now = Timestamp.now();
    const payload: Record<string, unknown> = {
      uid,
      organisationName,
      bio: input.bio !== undefined ? input.bio : (current?.bio ?? null),
      links: input.links ?? current?.links ?? [],
      logoUrl: current?.logoUrl ?? null,
      logoPublicId: current?.logoPublicId ?? null,
      createdAt: current?.createdAt ? Timestamp.fromDate(current.createdAt) : now,
      updatedAt: now,
    };

    transaction.set(reference, payload);

    return toView(uid, payload);
  });
}

export interface OrganiserLogoReference {
  readonly url: string;
  readonly publicId: string;
}

/** Writes the server-built logo URL and public id onto the profile. */
export async function storeOrganiserLogoReference(
  uid: string,
  logo: OrganiserLogoReference,
): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.organiserProfile(uid));
  const snapshot = await reference.get();

  if (!snapshot.exists) {
    throw new OrganiserProfileError(
      "not-found",
      "Save your organisation name before uploading a logo.",
    );
  }

  await reference.set(
    { logoUrl: logo.url, logoPublicId: logo.publicId, updatedAt: Timestamp.now() },
    { merge: true },
  );
}

/** Clears the logo reference and returns the old public id, if any. */
export async function clearOrganiserLogoReference(uid: string): Promise<string | null> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.organiserProfile(uid));
  const snapshot = await reference.get();

  if (!snapshot.exists) {
    return null;
  }

  const current = toView(uid, snapshot.data() as Record<string, unknown>);
  await reference.set(
    { logoUrl: null, logoPublicId: null, updatedAt: Timestamp.now() },
    { merge: true },
  );

  return current.logoPublicId;
}

/** Appends an audit entry for a profile edit made by its owner. */
export async function auditOrganiserProfileUpdate(actor: SessionUser): Promise<void> {
  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "organiser_profile.updated",
    targetType: "organiserProfile",
    targetId: actor.userId,
    tournamentId: null,
  });
}
