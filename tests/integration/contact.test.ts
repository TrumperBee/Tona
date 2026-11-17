// GCC - emulator-backed integration tests for Phase 14 WhatsApp contact.
//
// These drive the real route handlers, the real Admin SDK, the real message
// templates and the real rate limiter. They prove the privacy story rather than
// assuming it: the preview never carries a number, the link is minted only for
// a participant of a scheduled match, suspended opponents are refused, the rate
// limit holds, every issuance is recorded, and no public-read document written
// by the flow contains an E.164 number.
import type { CollectionReference } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionCookie } = vi.hoisted(() => ({
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

import {
  GET as contactGetRoute,
  POST as contactPostRoute,
} from "@/app/api/tournaments/[id]/matches/[matchId]/contact/route";
import { GET as organiserContactRoute } from "@/app/api/organiser/tournaments/[id]/registrations/[uid]/contact/route";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

import {
  buildRequest,
  clearEmulatorData,
  clearRateLimits,
  createEmulatorUser,
  createSessionFor,
  createSimulationTournament,
  type SimulationUser,
} from "./full-tournament";

const TOURNAMENT_ID = "contact-cup";
const TOURNAMENT_SLUG = "contact-cup";
const CONTACT_NOTE = "Please agree a time before Sunday";

const PLAYER_A_PHONE = "+254712345678";
const PLAYER_B_PHONE = "+447700900123";

let owner: SimulationUser;
let playerA: SimulationUser;
let playerB: SimulationUser;
let outsider: SimulationUser;
let suspended: SimulationUser;
let otherOrganiser: SimulationUser;

function context(matchId: string): { params: Promise<{ id: string; matchId: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID, matchId }) };
}

function organiserContext(uid: string): { params: Promise<{ id: string; uid: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID, uid }) };
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function setPhone(user: SimulationUser, phone: string | null): Promise<void> {
  await getFirebaseAdminFirestore().doc(paths.user(user.uid)).update({ whatsappE164: phone });
}

async function setStatus(user: SimulationUser, status: string): Promise<void> {
  await getFirebaseAdminFirestore().doc(paths.user(user.uid)).update({ status });
}

async function setContactNote(note: string | null): Promise<void> {
  await getFirebaseAdminFirestore()
    .doc(paths.tournament(TOURNAMENT_ID))
    .update({ contactNote: note });
}

interface MatchSeed {
  readonly matchId: string;
  readonly status?: "scheduled" | "completed";
  readonly stage?: "league" | "sf";
  readonly leg?: number | null;
  readonly tieId?: string | null;
  readonly participants?: readonly [string, string];
  readonly homeUid?: string;
  readonly awayUid?: string;
}

async function seedMatch(seed: MatchSeed): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const homeUid = seed.homeUid ?? playerA.uid;
  const awayUid = seed.awayUid ?? playerB.uid;

  await firestore.doc(paths.tournamentMatch(TOURNAMENT_ID, seed.matchId)).set({
    tournamentId: TOURNAMENT_ID,
    stage: seed.stage ?? "league",
    matchday: 1,
    homeUid,
    awayUid,
    homeTag: "Alpha",
    awayTag: "Bravo",
    participants: seed.participants ?? [homeUid, awayUid],
    status: seed.status ?? "scheduled",
    scheduledAt: null,
    result:
      seed.status === "completed"
        ? { homeGoals: 2, awayGoals: 1, enteredBy: "seed", enteredAt: now, editCount: 0 }
        : null,
    tieId: seed.tieId ?? null,
    leg: seed.leg ?? null,
    updatedAt: now,
  });
}

async function getPreview(matchId: string): Promise<Response> {
  return contactGetRoute(
    buildRequest("GET", `/api/tournaments/${TOURNAMENT_ID}/matches/${matchId}/contact`),
    context(matchId),
  );
}

async function postContact(matchId: string, body?: unknown): Promise<Response> {
  return contactPostRoute(
    buildRequest(
      "POST",
      `/api/tournaments/${TOURNAMENT_ID}/matches/${matchId}/contact`,
      body ?? {},
    ),
    context(matchId),
  );
}

interface ContactEvent {
  readonly tournamentId?: unknown;
  readonly matchId?: unknown;
  readonly fromUid?: unknown;
  readonly toUid?: unknown;
  readonly templateId?: unknown;
  readonly createdAt?: unknown;
}

async function readContactEvents(): Promise<ContactEvent[]> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.contactEvents()).get();
  return snapshot.docs.map((document) => document.data() as ContactEvent);
}

/** Every document a public-read rule allows a client to read. */
async function readPublicDocuments(): Promise<unknown[]> {
  const firestore = getFirebaseAdminFirestore();
  const documents: unknown[] = [];

  async function readCollectionGroup(collection: CollectionReference): Promise<void> {
    const snapshot = await collection.get();
    for (const document of snapshot.docs) {
      documents.push(document.data());
      const subcollections = await document.ref.listCollections();
      for (const subcollection of subcollections) {
        const subSnapshot = await subcollection.get();
        for (const subDocument of subSnapshot.docs) {
          documents.push(subDocument.data());
        }
      }
    }
  }

  await readCollectionGroup(firestore.collection(paths.publicProfiles()));
  await readCollectionGroup(firestore.collection(paths.tournaments()));
  await readCollectionGroup(firestore.collection(paths.announcements()));
  await readCollectionGroup(firestore.collection(paths.hallOfFame()));

  const rankings = await firestore.collection(paths.rankings()).get();
  for (const game of rankings.docs) {
    const players = await game.ref.collection("players").get();
    for (const player of players.docs) {
      documents.push(player.data());
    }
  }

  return documents;
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulatorData();

  const firestore = getFirebaseAdminFirestore();
  const events = await firestore.collection(paths.contactEvents()).get();
  if (!events.empty) {
    const batch = firestore.batch();
    events.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }

  await clearRateLimits();

  owner = await createEmulatorUser({
    email: "contact-owner@example.com",
    role: "organiser",
    gamerTag: "ContactOwner",
  });
  otherOrganiser = await createEmulatorUser({
    email: "contact-other@example.com",
    role: "organiser",
    gamerTag: "OtherOrganiser",
  });
  playerA = await createEmulatorUser({
    email: "contact-a@example.com",
    role: "user",
    gamerTag: "Alpha",
  });
  playerB = await createEmulatorUser({
    email: "contact-b@example.com",
    role: "user",
    gamerTag: "Bravo",
  });
  outsider = await createEmulatorUser({
    email: "contact-out@example.com",
    role: "user",
    gamerTag: "Outsider",
  });
  suspended = await createEmulatorUser({
    email: "contact-suspended@example.com",
    role: "user",
    gamerTag: "Suspended",
  });

  await createSimulationTournament({
    tournamentId: TOURNAMENT_ID,
    slug: TOURNAMENT_SLUG,
    name: "Contact Cup",
    ownerUid: owner.uid,
    status: "league_phase",
    withPlayers: false,
  });

  await Promise.all([
    setPhone(playerA, PLAYER_A_PHONE),
    setPhone(playerB, PLAYER_B_PHONE),
    setPhone(suspended, "+254799999999"),
  ]);

  sessionCookie.value = await createSessionFor(playerA);
});

afterAll(async () => {
  await clearEmulatorData();
});

describe("player contact preview", () => {
  it("returns the suggested message without a link or a number", async () => {
    await seedMatch({ matchId: "m-preview" });

    const response = await getPreview("m-preview");
    expect(response.status).toBe(200);

    const body = await bodyOf(response);
    expect(body.available).toBe(true);
    expect(typeof body.message).toBe("string");
    expect(String(body.message)).toContain("Alpha");
    expect(String(body.message)).toContain("Bravo");
    expect(String(body.message)).toContain("Contact Cup");
    expect(String(body.message)).toContain("Matchday 1");

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("wa.me");
    expect(serialised).not.toContain("254712345678");
    expect(serialised).not.toContain(PLAYER_B_PHONE);
    expect(serialised).not.toContain(PLAYER_A_PHONE);

    // The preview is a read: it must not record an issuance.
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("appends the organiser contact note and reports it separately", async () => {
    await setContactNote(CONTACT_NOTE);
    await seedMatch({ matchId: "m-note" });

    const response = await getPreview("m-note");
    const body = await bodyOf(response);

    expect(body.contactNote).toBe(CONTACT_NOTE);
    expect(String(body.message).endsWith(`\n\n${CONTACT_NOTE}`)).toBe(true);
  });

  it("reports a neutral unavailable reason when the opponent is suspended", async () => {
    await setStatus(playerB, "suspended");
    await seedMatch({ matchId: "m-suspended-preview" });

    const response = await getPreview("m-suspended-preview");
    expect(response.status).toBe(200);

    const body = await bodyOf(response);
    expect(body.available).toBe(false);
    expect(String(body.reason)).toContain("cannot be contacted");
    expect(JSON.stringify(body)).not.toContain(PLAYER_B_PHONE);
  });

  it("refuses a signed-out viewer", async () => {
    await seedMatch({ matchId: "m-signed-out" });
    sessionCookie.value = undefined;

    const response = await getPreview("m-signed-out");
    expect(response.status).toBe(401);
  });
});

describe("player contact issuance", () => {
  it("mints a wa.me link for a participant of a scheduled match", async () => {
    await setContactNote(CONTACT_NOTE);
    await seedMatch({ matchId: "m-issue" });

    const response = await postContact("m-issue");
    expect(response.status).toBe(200);

    const body = await bodyOf(response);
    expect(typeof body.link).toBe("string");

    const link = String(body.link);
    expect(link.startsWith(`https://wa.me/${PLAYER_B_PHONE.slice(1)}?text=`)).toBe(true);

    const encoded = link.split("?text=")[1] ?? "";
    const message = decodeURIComponent(encoded);
    expect(message).toContain("Alpha");
    expect(message).toContain("Bravo");
    expect(message.endsWith(`\n\n${CONTACT_NOTE}`)).toBe(true);
    // UTF-8 payloads survive the round trip.
    expect(message).toContain("👋");
  });

  it("uses the player's edited message and records a null template", async () => {
    await seedMatch({ matchId: "m-edited" });
    const edited = "Hey Bravo, can we play at 20:00 on Friday? — Alpha";

    const response = await postContact("m-edited", { message: edited });
    expect(response.status).toBe(200);

    const link = String((await bodyOf(response)).link);
    expect(decodeURIComponent(link.split("?text=")[1] ?? "")).toBe(edited);

    const events = await readContactEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.templateId).toBeNull();
  });

  it("accepts an explicit variant and records it as the template", async () => {
    await seedMatch({ matchId: "m-variant" });

    const response = await postContact("m-variant", {
      variant: "match-contact-knockout-leg-2",
    });
    expect(response.status).toBe(200);

    const message = decodeURIComponent(
      String((await bodyOf(response)).link).split("?text=")[1] ?? "",
    );
    expect(message).toContain("second leg");

    const events = await readContactEvents();
    expect(events[0]?.templateId).toBe("match-contact-knockout-leg-2");
  });

  it("rejects an unknown variant", async () => {
    await seedMatch({ matchId: "m-bad-variant" });

    const response = await postContact("m-bad-variant", { variant: "organiser-contact" });
    expect(response.status).toBe(400);
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("records an issuance without a phone number or a message body", async () => {
    await seedMatch({ matchId: "m-recorded" });

    const response = await postContact("m-recorded");
    expect(response.status).toBe(200);

    const events = await readContactEvents();
    expect(events).toHaveLength(1);

    const event = events[0] ?? {};
    expect(event.tournamentId).toBe(TOURNAMENT_ID);
    expect(event.matchId).toBe("m-recorded");
    expect(event.fromUid).toBe(playerA.uid);
    expect(event.toUid).toBe(playerB.uid);
    expect(event.templateId).toBe("match-contact-league");
    expect(event.createdAt).toBeTruthy();
    expect(Object.keys(event).sort()).toEqual(
      ["createdAt", "fromUid", "matchId", "templateId", "toUid", "tournamentId"].sort(),
    );

    const serialised = JSON.stringify(event);
    expect(serialised).not.toContain(PLAYER_B_PHONE);
    expect(serialised).not.toContain("Matchday");
  });

  it("lets the away player contact the home player", async () => {
    await seedMatch({ matchId: "m-away" });
    sessionCookie.value = await createSessionFor(playerB);

    const response = await postContact("m-away");
    expect(response.status).toBe(200);
    expect(String((await bodyOf(response)).link)).toContain(PLAYER_A_PHONE.slice(1));
  });

  it("refuses a non-participant", async () => {
    await seedMatch({ matchId: "m-outsider" });
    sessionCookie.value = await createSessionFor(outsider);

    const response = await postContact("m-outsider");
    expect(response.status).toBe(403);
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("refuses a completed match", async () => {
    await seedMatch({ matchId: "m-completed", status: "completed" });

    const response = await postContact("m-completed");
    expect(response.status).toBe(409);
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("refuses a suspended opponent", async () => {
    await setStatus(playerB, "suspended");
    await seedMatch({ matchId: "m-suspended" });

    const response = await postContact("m-suspended");
    expect(response.status).toBe(409);
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("refuses a banned opponent", async () => {
    await setStatus(playerB, "banned");
    await seedMatch({ matchId: "m-banned" });

    const response = await postContact("m-banned");
    expect(response.status).toBe(409);
  });

  it("refuses a knockout match whose other side is not decided", async () => {
    // The stored slot is an empty uid until the previous round resolves.
    await seedMatch({
      matchId: "m-undecided",
      stage: "sf",
      leg: 1,
      tieId: "sf-1",
      homeUid: "",
      awayUid: playerB.uid,
      participants: ["", playerB.uid],
    });
    sessionCookie.value = await createSessionFor(playerB);

    const response = await postContact("m-undecided");
    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("not been decided");
  });

  it("refuses an opponent with no WhatsApp number", async () => {
    await setPhone(playerB, null);
    await seedMatch({ matchId: "m-no-phone" });

    const response = await postContact("m-no-phone");
    expect(response.status).toBe(409);
    expect(String((await bodyOf(response)).error)).toContain("WhatsApp number");
  });

  it("enforces 30 issuances per hour and then refuses", async () => {
    await seedMatch({ matchId: "m-rate" });
    await clearRateLimits();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect((await postContact("m-rate")).status).toBe(200);
    }

    const limited = await postContact("m-rate");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(await readContactEvents()).toHaveLength(30);
  }, 120_000);
});

describe("public documents never carry a phone number", () => {
  it("contains no E.164 pattern after a full contact flow", async () => {
    await setContactNote(CONTACT_NOTE);
    await seedMatch({ matchId: "m-scan" });
    await postContact("m-scan");
    await postContact("m-scan", { message: "Custom message with no number" });

    const documents = await readPublicDocuments();
    expect(documents.length).toBeGreaterThan(0);

    const e164 = /\+[1-9]\d{6,14}(?!\d)/;
    for (const document of documents) {
      // A number is a scalar string field. Serialising the document catches it
      // wherever it hides, including nested objects and arrays.
      expect(JSON.stringify(document)).not.toMatch(e164);
    }
  });
});

describe("organiser contact route", () => {
  beforeEach(async () => {
    await getFirebaseAdminFirestore()
      .doc(paths.tournamentRegistration(TOURNAMENT_ID, playerB.uid))
      .set({
        tournamentId: TOURNAMENT_ID,
        gamerTag: "Bravo",
        gamerTagLower: "bravo",
        country: "KE",
        avatarUrl: null,
        platform: "android",
        status: "registered",
        registeredAt: new Date(),
        withdrawnAt: null,
        removedAt: null,
        removedBy: null,
      });
    await setContactNote(CONTACT_NOTE);
    sessionCookie.value = await createSessionFor(owner);
  });

  it("issues a generic link plus the contact note and audits it", async () => {
    const response = await organiserContactRoute(
      buildRequest(
        "GET",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/registrations/${playerB.uid}/contact`,
      ),
      organiserContext(playerB.uid),
    );
    expect(response.status).toBe(200);

    const link = String((await bodyOf(response)).link);
    expect(link.startsWith(`https://wa.me/${PLAYER_B_PHONE.slice(1)}?text=`)).toBe(true);

    const message = decodeURIComponent(link.split("?text=")[1] ?? "");
    expect(message).toContain("Contact Cup");
    expect(message).toContain(CONTACT_NOTE);

    const audits = await getFirebaseAdminFirestore()
      .collection(paths.auditLogs())
      .where("action", "==", "tournament.contact_link_issued")
      .get();
    expect(audits.size).toBe(1);
    expect(JSON.stringify(audits.docs[0]?.data())).not.toContain(PLAYER_B_PHONE);

    // The organiser path is audited, not counted as a player contact event.
    expect(await readContactEvents()).toHaveLength(0);
  });

  it("hides the route from another organiser", async () => {
    sessionCookie.value = await createSessionFor(otherOrganiser);

    const response = await organiserContactRoute(
      buildRequest(
        "GET",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/registrations/${playerB.uid}/contact`,
      ),
      organiserContext(playerB.uid),
    );
    expect(response.status).toBe(404);
  });

  it("refuses a plain player", async () => {
    sessionCookie.value = await createSessionFor(outsider);

    const response = await organiserContactRoute(
      buildRequest(
        "GET",
        `/api/organiser/tournaments/${TOURNAMENT_ID}/registrations/${playerB.uid}/contact`,
      ),
      organiserContext(playerB.uid),
    );
    expect(response.status).toBe(403);
  });
});
