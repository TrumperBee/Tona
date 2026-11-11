// GCC - organiser application domain logic.
//
// Submission, withdrawal, approval and rejection are server-only. Approval is
// the only path that grants the organiser custom claim, and it rolls the
// application back to `pending` if the claim cannot be written.
import "server-only";

import { Timestamp, type DocumentSnapshot, type Query } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { applicationCooldown, type CooldownDecision } from "@/lib/applications/cooldown";
import type { SessionUser } from "@/lib/auth/session";
import { setUserRole } from "@/lib/auth/management";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { ensureOrganiserProfile } from "@/lib/organiser/profile";
import { createNotification } from "@/lib/notifications";
import { getPlatformSettings } from "@/lib/platform/settings";
import type { AdminApplicationSubmitInput } from "@/lib/validation/admin-application";
import type {
  AdminApplicationDocument,
  ApplicationStateDocument,
  ApplicationStatus,
  UserDocument,
} from "@/types/domain";

export const APPLICATION_PAGE_SIZE = 20;

export class ApplicationNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "That application no longer exists.") {
    super(message);
    this.name = "ApplicationNotFoundError";
  }
}

export class ApplicationConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "ApplicationConflictError";
  }
}

export class ApplicationInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ApplicationInputError";
  }
}

export class ApplicationCooldownError extends Error {
  readonly status = 409;
  readonly reapplyAt: Date;

  constructor(reapplyAt: Date) {
    super("Your reapplication window has not opened yet.");
    this.name = "ApplicationCooldownError";
    this.reapplyAt = reapplyAt;
  }
}

export class ApplicationClaimError extends Error {
  readonly status = 500;

  constructor(
    message = "The organiser role could not be granted. The application was left pending.",
  ) {
    super(message);
    this.name = "ApplicationClaimError";
  }
}

export interface ApplicationRow {
  readonly id: string;
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly communityName: string;
  readonly expectedPlayers: string;
  readonly status: ApplicationStatus;
  readonly createdAt: Date | null;
}

export interface ApplicationListResult {
  readonly rows: readonly ApplicationRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

function toAdminApplication(data: DocumentSnapshot): AdminApplicationDocument {
  return data.data() as AdminApplicationDocument;
}

async function avatarMap(uids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(uids)];
  const map = new Map<string, string | null>();

  if (unique.length === 0) {
    return map;
  }

  const firestore = getFirebaseAdminFirestore();
  const snapshots = await firestore.getAll(...unique.map((uid) => firestore.doc(paths.user(uid))));

  for (const snapshot of snapshots) {
    const avatarUrl = snapshot.data()?.avatarUrl;
    map.set(snapshot.id, typeof avatarUrl === "string" ? avatarUrl : null);
  }

  return map;
}

/** Cursor-paginated review queue. Pending applications are oldest first. */
export async function listApplications(options: {
  readonly status: ApplicationStatus;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}): Promise<ApplicationListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.adminApplications());
  const filtered = collection.where("status", "==", options.status);
  const ascending = options.status === "pending";
  let query: Query = filtered.orderBy("createdAt", ascending ? "asc" : "desc");
  const pageSize = Math.min(25, Math.max(5, Math.trunc(options.pageSize ?? APPLICATION_PAGE_SIZE)));

  const afterSnapshot = options.after
    ? await firestore.doc(paths.adminApplication(options.after)).get()
    : null;
  if (afterSnapshot?.exists) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = options.before
    ? await firestore.doc(paths.adminApplication(options.before)).get()
    : null;
  if (beforeSnapshot?.exists) query = query.endBefore(beforeSnapshot);

  const pagedQuery =
    beforeSnapshot?.exists === true ? query.limitToLast(pageSize + 1) : query.limit(pageSize + 1);
  const [snapshot, countSnapshot] = await Promise.all([pagedQuery.get(), filtered.count().get()]);

  const rawDocs = snapshot.docs;
  const docs =
    beforeSnapshot?.exists === true && rawDocs.length > pageSize
      ? rawDocs.slice(1)
      : rawDocs.slice(0, pageSize);
  const avatars = await avatarMap(docs.map((document) => toAdminApplication(document).uid));

  return {
    rows: docs.map((document) => {
      const data = toAdminApplication(document);

      return {
        id: document.id,
        uid: data.uid,
        gamerTag: data.gamerTag,
        avatarUrl: avatars.get(data.uid) ?? null,
        communityName: data.communityName,
        expectedPlayers: data.expectedPlayers,
        status: data.status,
        createdAt: data.createdAt?.toDate() ?? null,
      };
    }),
    total: countSnapshot.data().count,
    hasMore: beforeSnapshot?.exists === true ? docs.length > 0 : rawDocs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

/** Exact counts for the review queue tabs. */
export async function applicationStatusCounts(): Promise<Record<ApplicationStatus, number>> {
  const collection = getFirebaseAdminFirestore().collection(paths.adminApplications());
  const statuses: readonly ApplicationStatus[] = [
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "revoked",
  ];
  const results = await Promise.all(
    statuses.map((status) => collection.where("status", "==", status).count().get()),
  );

  return {
    pending: results[0]?.data().count ?? 0,
    approved: results[1]?.data().count ?? 0,
    rejected: results[2]?.data().count ?? 0,
    withdrawn: results[3]?.data().count ?? 0,
    revoked: results[4]?.data().count ?? 0,
  };
}

export interface ApplicationDetail {
  readonly id: string;
  readonly application: AdminApplicationDocument;
  readonly user: UserDocument | null;
  readonly disabled: boolean;
  readonly previous: ReadonlyArray<{ id: string; data: AdminApplicationDocument }>;
}

/** One application plus the applicant snapshot, Auth state and prior history. */
export async function getApplicationDetail(id: string): Promise<ApplicationDetail> {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.doc(paths.adminApplication(id)).get();

  if (!snapshot.exists) {
    throw new ApplicationNotFoundError();
  }

  const application = toAdminApplication(snapshot);
  const [userSnapshot, authUser, previousSnapshot] = await Promise.all([
    firestore.doc(paths.user(application.uid)).get(),
    getFirebaseAdminAuth()
      .getUser(application.uid)
      .catch(() => null),
    firestore
      .collection(paths.adminApplications())
      .where("uid", "==", application.uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
  ]);

  return {
    id,
    application,
    user: userSnapshot.exists ? (userSnapshot.data() as UserDocument) : null,
    disabled: authUser?.disabled ?? false,
    previous: previousSnapshot.docs
      .filter((document) => document.id !== id)
      .map((document) => ({
        id: document.id,
        data: toAdminApplication(document),
      })),
  };
}

export interface ApplicantApplicationContext {
  readonly latest: { readonly id: string; readonly data: AdminApplicationDocument } | null;
  readonly state: ApplicationStateDocument | null;
  readonly cooldown: CooldownDecision;
}

/** Current applicant status + cooldown decision for the dashboard page. */
export async function getApplicantApplicationContext(
  uid: string,
): Promise<ApplicantApplicationContext> {
  const firestore = getFirebaseAdminFirestore();
  const [latestSnapshot, stateSnapshot, settings] = await Promise.all([
    firestore
      .collection(paths.adminApplications())
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
    firestore.doc(paths.applicationState(uid)).get(),
    getPlatformSettings(),
  ]);

  const state = stateSnapshot.exists ? (stateSnapshot.data() as ApplicationStateDocument) : null;
  const latestDocument = latestSnapshot.docs[0];

  return {
    latest: latestDocument
      ? { id: latestDocument.id, data: toAdminApplication(latestDocument) }
      : null,
    state,
    cooldown: applicationCooldown(
      state?.lastRejectedAt?.toDate() ?? null,
      settings.applicationCooldownDays,
    ),
  };
}

async function superAdminUid(): Promise<string | null> {
  const env = getServerEnv();

  try {
    const record = await getFirebaseAdminAuth().getUserByEmail(env.SUPER_ADMIN_EMAIL);
    return record.uid;
  } catch {
    return null;
  }
}

async function notifySuperAdminOfSubmission(
  id: string,
  gamerTag: string,
  communityName: string,
): Promise<void> {
  const uid = await superAdminUid();

  if (!uid) {
    return;
  }

  try {
    await createNotification(uid, {
      type: "application",
      title: "New organiser application",
      body: `@${gamerTag} applied to organise ${communityName}.`,
      link: `/super-admin/applications/${id}`,
    });
  } catch {
    // The application is already saved. A notification failure must not make
    // the applicant resubmit and create a duplicate pending record.
  }
}

function auditSummary(data: AdminApplicationSubmitInput) {
  return {
    communityName: data.communityName,
    communityType: data.communityType,
    expectedPlayers: data.expectedPlayers,
    gamesPlanned: data.gamesPlanned,
    communityLink: data.communityLink ?? null,
  };
}

/** Creates one pending application and its state marker atomically. */
export async function submitApplication(
  actor: SessionUser,
  input: AdminApplicationSubmitInput,
): Promise<{ id: string; status: ApplicationStatus }> {
  const firestore = getFirebaseAdminFirestore();
  const userSnapshot = await firestore.doc(paths.user(actor.userId)).get();

  if (!userSnapshot.exists) {
    throw new ApplicationInputError("Complete your profile before applying.");
  }

  const user = userSnapshot.data() as UserDocument;
  const settings = await getPlatformSettings();
  const now = Timestamp.now();
  const applicationReference = firestore.collection(paths.adminApplications()).doc();
  const stateReference = firestore.doc(paths.applicationState(actor.userId));

  await firestore.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateReference);
    const state = stateSnapshot.exists ? (stateSnapshot.data() as ApplicationStateDocument) : null;

    if (state?.status === "pending" && state.currentApplicationId) {
      throw new ApplicationConflictError("You already have a pending application.");
    }

    const lastRejectedAt = state?.lastRejectedAt?.toDate() ?? null;
    const decision = applicationCooldown(
      lastRejectedAt,
      settings.applicationCooldownDays,
      now.toDate(),
    );

    if (!decision.allowed && decision.reapplyAt) {
      throw new ApplicationCooldownError(decision.reapplyAt);
    }

    transaction.create(applicationReference, {
      uid: actor.userId,
      gamerTag: user.gamerTag,
      email: user.email || actor.email,
      communityName: input.communityName,
      communityType: input.communityType,
      communityLink: input.communityLink ?? null,
      expectedPlayers: input.expectedPlayers,
      gamesPlanned: input.gamesPlanned,
      experience: input.experience,
      motivation: input.motivation,
      agreesToRules: true,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    });

    transaction.set(
      stateReference,
      {
        uid: actor.userId,
        status: "pending",
        currentApplicationId: applicationReference.id,
        lastApplicationAt: now,
        lastRejectedAt: state?.lastRejectedAt ?? null,
        lastApprovedAt: state?.lastApprovedAt ?? null,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "application.submitted",
    targetType: "adminApplication",
    targetId: applicationReference.id,
    after: auditSummary(input),
  });

  await notifySuperAdminOfSubmission(applicationReference.id, user.gamerTag, input.communityName);

  return { id: applicationReference.id, status: "pending" };
}

/** Withdraws the caller's own pending application. */
export async function withdrawApplication(actor: SessionUser, id: string): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const applicationReference = firestore.doc(paths.adminApplication(id));
  const stateReference = firestore.doc(paths.applicationState(actor.userId));
  const now = Timestamp.now();
  let communityName = "";

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(applicationReference);

    if (!snapshot.exists) {
      throw new ApplicationNotFoundError();
    }

    const application = toAdminApplication(snapshot);

    if (application.uid !== actor.userId) {
      throw new ApplicationNotFoundError();
    }

    if (application.status !== "pending") {
      throw new ApplicationConflictError("Only a pending application can be withdrawn.");
    }

    communityName = application.communityName;
    transaction.update(applicationReference, { status: "withdrawn", updatedAt: now });
    transaction.set(
      stateReference,
      {
        uid: actor.userId,
        status: "none",
        currentApplicationId: null,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "application.withdrawn",
    targetType: "adminApplication",
    targetId: id,
    before: { status: "pending", communityName },
    after: { status: "withdrawn" },
  });
}

export interface ReviewResult {
  readonly uid: string;
  readonly alreadyReviewed: boolean;
}

async function validateApprovalTarget(uid: string): Promise<void> {
  const authUser = await getFirebaseAdminAuth()
    .getUser(uid)
    .catch(() => null);

  if (!authUser) {
    throw new ApplicationConflictError("The applicant account no longer exists.");
  }

  if (authUser.disabled) {
    throw new ApplicationConflictError("This applicant's account is disabled.");
  }

  const userSnapshot = await getFirebaseAdminFirestore().doc(paths.user(uid)).get();
  const status = userSnapshot.exists ? userSnapshot.data()?.status : "active";

  if (status === "suspended" || status === "banned") {
    throw new ApplicationConflictError(`This applicant's account is ${status}.`);
  }
}

/**
 * Approves a pending application and then grants the organiser claim.
 *
 * A repeated approval returns success without writing anything. If the claim
 * write fails, the application is returned to `pending` so the queue stays
 * truthful and the applicant can be reviewed again.
 */
export async function approveApplication(
  actor: SessionUser,
  id: string,
  note: string | null,
): Promise<ReviewResult> {
  const firestore = getFirebaseAdminFirestore();
  const applicationReference = firestore.doc(paths.adminApplication(id));
  const initialSnapshot = await applicationReference.get();

  if (!initialSnapshot.exists) {
    throw new ApplicationNotFoundError();
  }

  const initial = toAdminApplication(initialSnapshot);

  if (initial.status === "approved") {
    return { uid: initial.uid, alreadyReviewed: true };
  }

  if (initial.status !== "pending") {
    throw new ApplicationConflictError("Only a pending application can be approved.");
  }

  await validateApprovalTarget(initial.uid);

  const stateReference = firestore.doc(paths.applicationState(initial.uid));
  const now = Timestamp.now();
  let previousLastApprovedAt: Timestamp | null = null;
  let alreadyReviewed = false;

  await firestore.runTransaction(async (transaction) => {
    const [snapshot, stateSnapshot] = await Promise.all([
      transaction.get(applicationReference),
      transaction.get(stateReference),
    ]);

    if (!snapshot.exists) {
      throw new ApplicationNotFoundError();
    }

    const application = toAdminApplication(snapshot);

    if (application.status === "approved") {
      alreadyReviewed = true;
      return;
    }

    if (application.status !== "pending") {
      throw new ApplicationConflictError("Only a pending application can be approved.");
    }

    previousLastApprovedAt = stateSnapshot.exists
      ? ((stateSnapshot.data() as ApplicationStateDocument).lastApprovedAt ?? null)
      : null;

    transaction.update(applicationReference, {
      status: "approved",
      reviewedBy: actor.userId,
      reviewedAt: now,
      reviewNote: note,
      updatedAt: now,
    });
    transaction.set(
      stateReference,
      {
        uid: application.uid,
        status: "none",
        currentApplicationId: null,
        lastApprovedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  if (alreadyReviewed) {
    return { uid: initial.uid, alreadyReviewed: true };
  }

  try {
    await setUserRole(
      actor,
      initial.uid,
      "organiser",
      note ?? "Approved through the organiser application flow.",
    );
  } catch {
    await firestore.runTransaction(async (transaction) => {
      const [snapshot, stateSnapshot] = await Promise.all([
        transaction.get(applicationReference),
        transaction.get(stateReference),
      ]);

      if (snapshot.exists) {
        const application = toAdminApplication(snapshot);

        if (application.status === "approved" && application.reviewedBy === actor.userId) {
          transaction.update(applicationReference, {
            status: "pending",
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            updatedAt: Timestamp.now(),
          });
        }
      }

      if (stateSnapshot.exists) {
        transaction.set(
          stateReference,
          {
            uid: initial.uid,
            status: "pending",
            currentApplicationId: id,
            lastApprovedAt: previousLastApprovedAt,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
      }
    });

    throw new ApplicationClaimError();
  }

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "application.approved",
    targetType: "adminApplication",
    targetId: id,
    before: { status: "pending" },
    after: { status: "approved", note },
    reason: note,
  });

  // Best effort: the public organiser profile is also ensured on first entry to
  // the organiser area, so a failure here must never fail the approval itself.
  await ensureOrganiserProfile(initial.uid, {
    organisationName: initial.communityName,
  }).catch(() => null);

  await createNotification(initial.uid, {
    type: "application",
    title: "Organiser application approved",
    body: note
      ? `The Super Admin approved your application: ${note}`
      : "You can now create and run competitions. Sign in again to activate your organiser workspace.",
    link: "/dashboard/apply-admin",
  });

  return { uid: initial.uid, alreadyReviewed: false };
}

/** Rejects a pending application with a mandatory note. */
export async function rejectApplication(
  actor: SessionUser,
  id: string,
  note: string,
): Promise<ReviewResult> {
  const firestore = getFirebaseAdminFirestore();
  const applicationReference = firestore.doc(paths.adminApplication(id));
  const initialSnapshot = await applicationReference.get();

  if (!initialSnapshot.exists) {
    throw new ApplicationNotFoundError();
  }

  const initial = toAdminApplication(initialSnapshot);

  if (initial.status === "rejected") {
    return { uid: initial.uid, alreadyReviewed: true };
  }

  if (initial.status !== "pending") {
    throw new ApplicationConflictError("Only a pending application can be rejected.");
  }

  const stateReference = firestore.doc(paths.applicationState(initial.uid));
  const now = Timestamp.now();
  let alreadyReviewed = false;

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(applicationReference);

    if (!snapshot.exists) {
      throw new ApplicationNotFoundError();
    }

    const application = toAdminApplication(snapshot);

    if (application.status === "rejected") {
      alreadyReviewed = true;
      return;
    }

    if (application.status !== "pending") {
      throw new ApplicationConflictError("Only a pending application can be rejected.");
    }

    transaction.update(applicationReference, {
      status: "rejected",
      reviewedBy: actor.userId,
      reviewedAt: now,
      reviewNote: note,
      updatedAt: now,
    });
    transaction.set(
      stateReference,
      {
        uid: application.uid,
        status: "none",
        currentApplicationId: null,
        lastRejectedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  if (alreadyReviewed) {
    return { uid: initial.uid, alreadyReviewed: true };
  }

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "application.rejected",
    targetType: "adminApplication",
    targetId: id,
    before: { status: "pending" },
    after: { status: "rejected", note },
    reason: note,
  });

  await createNotification(initial.uid, {
    type: "application",
    title: "Organiser application not approved",
    body: note,
    link: "/dashboard/apply-admin",
  });

  return { uid: initial.uid, alreadyReviewed: false };
}
