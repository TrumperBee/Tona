// GCC - emulator-backed integration tests for Phase 16 notifications and email.
//
// Resend is replaced by an in-memory recorder so the real delivery pipeline
// (preferences, suppression, quota, rendering, unsubscribe headers) runs without
// a network call. `after()` is captured so deferred work can be awaited
// deterministically instead of racing the test runner.
import { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sentEmails, afterTasks, sessionCookie } = vi.hoisted(() => ({
  sentEmails: [] as Array<{
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
    kind?: string;
  }>,
  afterTasks: [] as Array<() => Promise<unknown>>,
  sessionCookie: { value: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gcc_session" && sessionCookie.value
        ? { name, value: sessionCookie.value }
        : undefined,
  }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (task: () => Promise<unknown>) => {
      afterTasks.push(task);
    },
  };
});

vi.mock("@/lib/email/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/client")>();
  return {
    ...actual,
    sendEmail: vi.fn(async (message: import("@/lib/email/client").EmailMessage) => {
      sentEmails.push(message);
      return { ok: true as const, simulated: false };
    }),
    sendEmailBatch: vi.fn(
      async (messages: readonly import("@/lib/email/client").EmailMessage[]) => {
        sentEmails.push(...messages);
        return messages.map(() => ({ ok: true as const, simulated: false }));
      },
    ),
  };
});

process.env.RESEND_API_KEY = "re_integration_test";
process.env.RESEND_FROM = "GCC <no-reply@example.com>";
process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from("integration-webhook-secret").toString(
  "base64",
)}`;
process.env.EMAIL_UNSUBSCRIBE_SECRET = "integration-unsubscribe-secret";
process.env.EMAIL_DAILY_LIMIT = "100";
process.env.EMAIL_MONTHLY_LIMIT = "3000";

import { POST as registerPlayerRoute } from "@/app/api/auth/register/route";
import { PATCH as changeEmailRoute } from "@/app/api/profile/email/route";
import { POST as unsubscribeRoute } from "@/app/api/unsubscribe/route";
import { POST as resendWebhookRoute } from "@/app/api/webhooks/resend/route";
import { AuthenticationError, requireFreshSession } from "@/lib/auth/guards";
import { broadcastPlatformAnnouncement } from "@/lib/email/announcements";
import { computeSvixSignature } from "@/lib/email/svix";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform/settings";
import { suppressEmail, suppressionId } from "@/lib/email/suppression";
import { notify } from "@/lib/notifications/service";
import { signUnsubscribeToken } from "@/lib/email/tokens";
import type { NotificationPrefs, UserRole } from "@/types/domain";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "owner@example.com";
const SUPER_ADMIN_UID = process.env.SUPER_ADMIN_UID ?? "integration-super-admin";

interface SeededUser {
  readonly uid: string;
  readonly email: string;
}

async function clearEmulator(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const users = await auth.listUsers(1000);

  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  for (const collection of [
    paths.users(),
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.auditLogs(),
    paths.platformSettings(),
    paths.rateLimits(),
    paths.announcements(),
    paths.emailUsage(),
    paths.emailSuppressions(),
    paths.emailFailures(),
  ]) {
    const snapshot = await firestore.collection(collection).get();

    if (!snapshot.empty) {
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }

  sentEmails.length = 0;
  afterTasks.length = 0;
}

async function createUser(options: {
  readonly email: string;
  readonly role: UserRole;
  readonly gamerTag: string;
  readonly notificationPrefs?: NotificationPrefs;
  readonly emailDeliverable?: boolean;
}): Promise<SeededUser> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const pinned = options.email === SUPER_ADMIN_EMAIL && options.role === "super_admin";
  const record = await auth.createUser({
    ...(pinned ? { uid: SUPER_ADMIN_UID } : {}),
    email: options.email,
    password: PASSWORD,
    displayName: options.gamerTag,
  });

  await auth.setCustomUserClaims(record.uid, { role: options.role });

  const now = new Date();
  await firestore.doc(paths.user(record.uid)).set({
    fullName: `${options.gamerTag} Player`,
    gamerTag: options.gamerTag,
    gamerTagLower: options.gamerTag.toLowerCase(),
    email: options.email,
    whatsappE164: null,
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
    community: null,
    favouriteClub: null,
    photoUrl: null,
    avatarUrl: null,
    avatarPublicId: null,
    role: options.role,
    status: "active",
    ...(options.notificationPrefs ? { notificationPrefs: options.notificationPrefs } : {}),
    ...(options.emailDeliverable === undefined
      ? {}
      : { emailDeliverable: options.emailDeliverable }),
    createdAt: now,
    updatedAt: now,
  });

  return { uid: record.uid, email: options.email };
}

async function signInIdToken(email: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Emulator sign-in failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { idToken: string };
  return payload.idToken;
}

async function sessionFor(user: SeededUser): Promise<string> {
  const idToken = await signInIdToken(user.email);
  return getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: 60 * 60 * 1000 });
}

function jsonRequest(method: "POST" | "PATCH", path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Runs every deferred task, including tasks queued by a deferred task. */
async function drainAfter(): Promise<void> {
  for (let guard = 0; guard < 20; guard += 1) {
    const task = afterTasks.shift();

    if (!task) {
      return;
    }

    await task();
  }
}

async function notificationDocs(uid: string): Promise<readonly Record<string, unknown>[]> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.userNotifications(uid)).get();

  return snapshot.docs.map((document) => document.data());
}

async function readUser(uid: string): Promise<Record<string, unknown>> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.user(uid)).get();
  return snapshot.data() ?? {};
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();
});

afterAll(async () => {
  await clearEmulator();
});

describe("notification email delivery", () => {
  it("always emails a critical kind even when every preference is off", async () => {
    const player = await createUser({
      email: "critical@example.com",
      role: "user",
      gamerTag: "CriticalPlayer",
      notificationPrefs: { important: false, resultEmails: false, announcementEmails: false },
    });

    await notify({
      recipients: player.uid,
      type: "account_suspended",
      title: "Your account was suspended",
      body: "Contact the platform team.",
      link: "/dashboard",
    });
    await drainAfter();

    const docs = await notificationDocs(player.uid);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.kind).toBe("account_suspended");
    expect(docs[0]?.type).toBe("system");

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe("critical@example.com");
    expect(sentEmails[0]?.subject).toBe("Your GCC account was suspended");
    expect(sentEmails[0]?.html).toContain("Critical account emails cannot be turned off.");
    expect(sentEmails[0]?.html).not.toContain("Unsubscribe from these emails");
    expect(sentEmails[0]?.headers).toBeUndefined();
  });

  it("emails an important kind by default with one-click unsubscribe headers", async () => {
    const player = await createUser({
      email: "important@example.com",
      role: "user",
      gamerTag: "ImportantPlayer",
    });

    await notify({
      recipients: player.uid,
      type: "draw_complete",
      title: "The draw is complete",
      body: "You are in Pot 2.",
      link: "/dashboard/tournaments/cup",
    });
    await drainAfter();

    expect(sentEmails).toHaveLength(1);
    const email = sentEmails[0];
    expect(email?.to).toBe("important@example.com");
    expect(email?.headers?.["List-Unsubscribe"]).toMatch(/^<http.*\/unsubscribe\?t=/);
    expect(email?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email?.html).toContain("/unsubscribe?t=");
    expect(email?.text).toContain("Unsubscribe:");

    const token = /\/unsubscribe\?t=([^"&\s]+)/.exec(email?.html ?? "")?.[1];
    expect(token).toBeTruthy();
  });

  it("does not email an important kind after the recipient disables it", async () => {
    const player = await createUser({
      email: "quiet@example.com",
      role: "user",
      gamerTag: "QuietPlayer",
      notificationPrefs: { important: false, resultEmails: false, announcementEmails: false },
    });

    await notify({
      recipients: player.uid,
      type: "registration_confirmed",
      title: "Your entry is confirmed",
      body: "You are in.",
    });
    await drainAfter();

    expect(await notificationDocs(player.uid)).toHaveLength(1);
    expect(sentEmails).toHaveLength(0);
  });

  it("keeps optional mail off until the stream is opted into", async () => {
    const player = await createUser({
      email: "optional@example.com",
      role: "user",
      gamerTag: "OptionalPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: false },
    });

    await notify({
      recipients: player.uid,
      type: "platform_announcement",
      title: "Season two opens",
      body: "Entries open on Monday.",
      link: "/announcements",
    });
    await drainAfter();
    expect(sentEmails).toHaveLength(0);

    await getFirebaseAdminFirestore()
      .doc(paths.user(player.uid))
      .update({
        notificationPrefs: { important: true, resultEmails: false, announcementEmails: true },
      });

    await notify({
      recipients: player.uid,
      type: "platform_announcement",
      title: "Season two opens",
      body: "Entries open on Monday.",
      link: "/announcements",
    });
    await drainAfter();

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe("optional@example.com");
  });

  it("skips an address on the suppression list, but still writes in-app", async () => {
    const player = await createUser({
      email: "suppressed@example.com",
      role: "user",
      gamerTag: "SuppressedPlayer",
    });
    await suppressEmail(player.email, "bounced");

    await notify({
      recipients: player.uid,
      type: "account_banned",
      title: "Your account was banned",
      body: "Appeal through the contact form.",
    });
    await drainAfter();

    expect(await notificationDocs(player.uid)).toHaveLength(1);
    expect(sentEmails).toHaveLength(0);
  });

  it("stops normal mail at 80% of the daily limit but lets critical mail use the remainder", async () => {
    const player = await createUser({
      email: "quota@example.com",
      role: "user",
      gamerTag: "QuotaPlayer",
    });
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10).replace(/-/g, "");
    const monthKey = `month-${now.toISOString().slice(0, 7).replace(/-/g, "")}`;
    const firestore = getFirebaseAdminFirestore();

    await Promise.all([
      firestore.doc(paths.emailUsageDay(dayKey)).set({
        sent: 80,
        skipped: 0,
        failed: 0,
        updatedAt: Timestamp.now(),
      }),
      firestore.doc(paths.emailUsageDay(monthKey)).set({
        sent: 80,
        skipped: 0,
        failed: 0,
        updatedAt: Timestamp.now(),
      }),
    ]);

    await notify({
      recipients: player.uid,
      type: "draw_complete",
      title: "The draw is complete",
      body: "Normal mail must stop.",
    });
    await drainAfter();

    expect(sentEmails).toHaveLength(0);

    await notify({
      recipients: player.uid,
      type: "tournament_cancelled",
      title: "A tournament was cancelled",
      body: "Critical mail may use the remainder.",
    });
    await drainAfter();

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe("quota@example.com");
    expect(await notificationDocs(player.uid)).toHaveLength(2);
  });
});

describe("unsubscribe", () => {
  it("applies the stream from a signed token and rejects an invalid one", async () => {
    const player = await createUser({
      email: "unsubscribe@example.com",
      role: "user",
      gamerTag: "UnsubPlayer",
      notificationPrefs: { important: true, resultEmails: true, announcementEmails: true },
    });
    const token = signUnsubscribeToken(process.env.EMAIL_UNSUBSCRIBE_SECRET as string, {
      uid: player.uid,
      category: "important",
      expiresAt: Date.now() + 60_000,
    });

    const response = await unsubscribeRoute(jsonRequest("POST", "/api/unsubscribe", { token }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, category: "important" });

    const stored = (await readUser(player.uid)).notificationPrefs as NotificationPrefs;
    expect(stored).toEqual({ important: false, resultEmails: true, announcementEmails: true });

    const invalid = await unsubscribeRoute(
      jsonRequest("POST", "/api/unsubscribe", { token: "not-a-token" }),
    );
    expect(invalid.status).toBe(400);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const player = await createUser({
      email: "forged@example.com",
      role: "user",
      gamerTag: "ForgedPlayer",
    });
    const token = signUnsubscribeToken("the-wrong-secret", {
      uid: player.uid,
      category: "announcement",
      expiresAt: Date.now() + 60_000,
    });

    const response = await unsubscribeRoute(jsonRequest("POST", "/api/unsubscribe", { token }));

    expect(response.status).toBe(400);
    expect((await readUser(player.uid)).notificationPrefs).toBeUndefined();
  });
});

describe("Resend webhook", () => {
  const webhookSecret = () => process.env.RESEND_WEBHOOK_SECRET as string;

  function webhookRequest(
    payload: unknown,
    options: { readonly forge?: boolean } = {},
  ): NextRequest {
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = `msg_${Date.now()}`;
    const signature = options.forge
      ? "v1,AAAA"
      : `v1,${computeSvixSignature(webhookSecret(), id, timestamp, rawBody)}`;

    return new NextRequest("http://localhost:3000/api/webhooks/resend", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
      body: rawBody,
    });
  }

  it("suppresses a permanent bounce, marks the owner undeliverable and blocks future mail", async () => {
    const player = await createUser({
      email: "bounce@example.com",
      role: "user",
      gamerTag: "BouncePlayer",
    });

    const response = await resendWebhookRoute(
      webhookRequest({
        type: "email.bounced",
        data: { to: [player.email], bounce: { type: "Permanent" } },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, handled: true, suppressed: 1 });

    const suppression = await getFirebaseAdminFirestore()
      .doc(paths.emailSuppression(suppressionId(player.email)))
      .get();
    expect(suppression.exists).toBe(true);
    expect(suppression.data()?.reason).toBe("bounced");
    expect((await readUser(player.uid)).emailDeliverable).toBe(false);

    await notify({
      recipients: player.uid,
      type: "account_restored",
      title: "Your account was restored",
      body: "Welcome back.",
    });
    await drainAfter();

    expect(sentEmails).toHaveLength(0);
  });

  it("treats a complaint as a suppression and ignores a transient bounce", async () => {
    const complained = await createUser({
      email: "complaint@example.com",
      role: "user",
      gamerTag: "ComplaintPlayer",
    });
    const transient = await createUser({
      email: "transient@example.com",
      role: "user",
      gamerTag: "TransientPlayer",
    });

    const complaint = await resendWebhookRoute(
      webhookRequest({ type: "email.complained", data: { to: [complained.email] } }),
    );
    const bounce = await resendWebhookRoute(
      webhookRequest({
        type: "email.bounced",
        data: { to: [transient.email], bounce: { type: "Transient" } },
      }),
    );

    expect(complaint.status).toBe(200);
    expect(bounce.status).toBe(200);
    expect(await bounce.json()).toEqual({ ok: true, handled: false });

    const firestore = getFirebaseAdminFirestore();
    const complaintDoc = await firestore
      .doc(paths.emailSuppression(suppressionId(complained.email)))
      .get();
    const transientDoc = await firestore
      .doc(paths.emailSuppression(suppressionId(transient.email)))
      .get();

    expect(complaintDoc.exists).toBe(true);
    expect(transientDoc.exists).toBe(false);
  });

  it("rejects a forged signature without writing anything", async () => {
    const player = await createUser({
      email: "forge-target@example.com",
      role: "user",
      gamerTag: "ForgeTarget",
    });

    const response = await resendWebhookRoute(
      webhookRequest(
        { type: "email.bounced", data: { to: [player.email], bounce: { type: "Permanent" } } },
        { forge: true },
      ),
    );

    expect(response.status).toBe(401);
    expect((await readUser(player.uid)).emailDeliverable).not.toBe(false);
  });
});

describe("change email", () => {
  it("updates Auth and the mirror, revokes sessions and emails the old address", async () => {
    const player = await createUser({
      email: "old@example.com",
      role: "user",
      gamerTag: "MovingPlayer",
    });
    sessionCookie.value = await sessionFor(player);

    const response = await changeEmailRoute(
      jsonRequest("PATCH", "/api/profile/email", { email: "new@example.com" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      email: "new@example.com",
      signedOut: true,
    });
    expect(response.headers.get("set-cookie")).toContain("gcc_session=");

    const authUser = await getFirebaseAdminAuth().getUser(player.uid);
    expect(authUser.email).toBe("new@example.com");

    const stored = await readUser(player.uid);
    expect(stored.email).toBe("new@example.com");
    expect(stored.emailDeliverable).toBe(true);

    const audits = await getFirebaseAdminFirestore().collection(paths.auditLogs()).get();
    expect(audits.docs.some((document) => document.data().action === "user.email.changed")).toBe(
      true,
    );

    await drainAfter();

    expect(
      sentEmails.some(
        (email) =>
          email.to === "old@example.com" && email.subject === "Your GCC email address was changed",
      ),
    ).toBe(true);
  });

  it("refuses an address already used by another account", async () => {
    const player = await createUser({
      email: "first@example.com",
      role: "user",
      gamerTag: "FirstPlayer",
    });
    await createUser({
      email: "taken@example.com",
      role: "user",
      gamerTag: "SecondPlayer",
    });
    sessionCookie.value = await sessionFor(player);

    const response = await changeEmailRoute(
      jsonRequest("PATCH", "/api/profile/email", { email: "taken@example.com" }),
    );
    const payload = (await response.json()) as { fieldErrors?: Record<string, string> };

    expect(response.status).toBe(400);
    expect(payload.fieldErrors?.email).toMatch(/already exists/i);
    expect((await getFirebaseAdminAuth().getUser(player.uid)).email).toBe("first@example.com");
  });

  it("blocks the pinned Super Admin account", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "RootOwner",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await changeEmailRoute(
      jsonRequest("PATCH", "/api/profile/email", { email: "another-owner@example.com" }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()) as { error: string }).toHaveProperty("error");
    expect((await getFirebaseAdminAuth().getUser(root.uid)).email).toBe(SUPER_ADMIN_EMAIL);
  });

  it("allows at most three attempts per day", async () => {
    const player = await createUser({
      email: "limit@example.com",
      role: "user",
      gamerTag: "LimitPlayer",
    });
    sessionCookie.value = await sessionFor(player);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await changeEmailRoute(
        jsonRequest("PATCH", "/api/profile/email", { email: "not-an-email" }),
      );
      expect(response.status).toBe(400);
    }

    const blocked = await changeEmailRoute(
      jsonRequest("PATCH", "/api/profile/email", { email: "another@example.com" }),
    );
    expect(blocked.status).toBe(429);
  });

  it("rejects a session older than the fresh-sign-in window", async () => {
    const player = await createUser({
      email: "stale@example.com",
      role: "user",
      gamerTag: "StalePlayer",
    });
    sessionCookie.value = await sessionFor(player);

    await expect(requireFreshSession(-1)).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe("welcome email", () => {
  it("sends once after a successful registration", async () => {
    const response = await registerPlayerRoute(
      jsonRequest("POST", "/api/auth/register", {
        fullName: "Welcome Player",
        gamerTag: "WelcomePlayer",
        email: "welcome@example.com",
        password: PASSWORD,
        country: "KE",
        preferredGame: "efootball",
        platform: "android",
        acceptTerms: true,
      }),
    );

    expect(response.status).toBe(201);
    await drainAfter();

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe("welcome@example.com");
    expect(sentEmails[0]?.subject).toBe("Welcome to GCC");
    expect(sentEmails[0]?.html).toContain("WelcomePlayer");
  });
});

describe("announcement broadcast", () => {
  async function setAnnouncements(enabled: boolean): Promise<void> {
    await getFirebaseAdminFirestore()
      .doc(paths.platformSettingsMain())
      .set({
        ...DEFAULT_PLATFORM_SETTINGS,
        emailAnnouncements: enabled,
        updatedBy: SUPER_ADMIN_UID,
        updatedAt: Timestamp.now(),
      });
  }

  it("emails only opted-in users and writes one in-app record each", async () => {
    await setAnnouncements(true);
    const optedIn = await createUser({
      email: "optin@example.com",
      role: "user",
      gamerTag: "OptInPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: true },
    });
    const optedOut = await createUser({
      email: "optout@example.com",
      role: "user",
      gamerTag: "OptOutPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: false },
    });

    const result = await broadcastPlatformAnnouncement({
      title: "Season two opens",
      body: "Entries open on Monday.",
      link: "/announcements",
    });
    await drainAfter();

    expect(result).toEqual({ status: "scheduled", recipients: 1 });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe("optin@example.com");
    expect(await notificationDocs(optedIn.uid)).toHaveLength(1);
    expect(await notificationDocs(optedOut.uid)).toHaveLength(0);
  });

  it("does nothing while the platform switch is off", async () => {
    await setAnnouncements(false);
    const player = await createUser({
      email: "switch@example.com",
      role: "user",
      gamerTag: "SwitchPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: true },
    });

    const result = await broadcastPlatformAnnouncement({
      title: "Quiet",
      body: "This must not send.",
      link: "/announcements",
    });
    await drainAfter();

    expect(result).toEqual({ status: "disabled", recipients: 0 });
    expect(sentEmails).toHaveLength(0);
    expect(await notificationDocs(player.uid)).toHaveLength(0);
  });

  it("refuses a broadcast once the monthly reference is used", async () => {
    await setAnnouncements(true);
    const now = new Date();
    const monthKey = `month-${now.toISOString().slice(0, 7).replace(/-/g, "")}`;

    await getFirebaseAdminFirestore().doc(paths.emailUsageDay(monthKey)).set({
      sent: 3000,
      skipped: 0,
      failed: 0,
      updatedAt: Timestamp.now(),
    });
    await createUser({
      email: "blocked@example.com",
      role: "user",
      gamerTag: "BlockedPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: true },
    });

    const result = await broadcastPlatformAnnouncement({
      title: "Too many",
      body: "Monthly reference is used.",
      link: "/announcements",
    });
    await drainAfter();

    expect(result).toEqual({ status: "monthly_quota_exhausted", recipients: 0 });
    expect(sentEmails).toHaveLength(0);
  });

  it("refuses a broadcast that would exceed the remaining normal daily budget", async () => {
    await setAnnouncements(true);
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10).replace(/-/g, "");

    await getFirebaseAdminFirestore().doc(paths.emailUsageDay(dayKey)).set({
      sent: 80,
      skipped: 0,
      failed: 0,
      updatedAt: Timestamp.now(),
    });
    const player = await createUser({
      email: "daily-cap@example.com",
      role: "user",
      gamerTag: "DailyCapPlayer",
      notificationPrefs: { important: true, resultEmails: false, announcementEmails: true },
    });

    const result = await broadcastPlatformAnnouncement({
      title: "No budget",
      body: "The normal daily cap is already used.",
      link: "/announcements",
    });
    await drainAfter();

    expect(result).toEqual({ status: "daily_quota_exhausted", recipients: 1 });
    expect(sentEmails).toHaveLength(0);
    expect(await notificationDocs(player.uid)).toHaveLength(0);
  });
});
