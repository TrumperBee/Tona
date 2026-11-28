/**
 * GCC - Firestore/Admin backup export (free-plan alternative).
 *
 * Exports important collections to timestamped JSON in ignored backups/.
 * Uses Admin SDK credentials from .env.local / env. Paginated, progress logged,
 * requires explicit Firebase project id confirmation before writing.
 */
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import process from "node:process";

type Firestore = import("firebase-admin/firestore").Firestore;

function loadEnvLocal(): void {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  } catch {
    // env may already be provided by shell/CI
  }
}

async function confirm(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Date) return { __type: "date", value: value.toISOString() };
  if (typeof value === "object") {
    const v = value as Record<string, unknown> & {
      toDate?: () => Date;
      seconds?: number;
      path?: string;
      constructor?: { name?: string };
    };
    if (typeof v.toDate === "function" && typeof v.seconds === "number") {
      return { __type: "timestamp", value: v.toDate().toISOString() };
    }
    if (v.constructor?.name === "DocumentReference" && typeof v.path === "string") {
      return { __type: "ref", path: v.path };
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = serialize(val);
    return out;
  }
  return value;
}

async function exportCollection(db: Firestore, collection: string, dir: string): Promise<number> {
  const docs: unknown[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection(collection).orderBy("__name__").limit(200) as FirebaseFirestore.Query;
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = serialize(doc.data()) as Record<string, unknown>;
      if (collection === "users") {
        delete data.passwordHash;
        delete data.password;
        delete data.privateKey;
      }
      docs.push({ id: doc.id, path: doc.ref.path, data });
    }
    last = snap.docs[snap.docs.length - 1];
    console.log(`[backup] ${collection}: ${docs.length}`);
    if (snap.size < 200) break;
  }
  await fs.writeFile(
    path.join(dir, `${collection}.json`),
    JSON.stringify(
      { collection, count: docs.length, exportedAt: new Date().toISOString(), docs },
      null,
      2,
    ),
  );
  return docs.length;
}

async function exportTournamentSubcollections(db: Firestore, dir: string): Promise<number> {
  const tournaments = await db.collection("tournaments").get();
  let total = 0;
  for (const t of tournaments.docs) {
    const tDir = path.join(dir, "tournaments", t.id);
    await fs.mkdir(tDir, { recursive: true });
    for (const sub of [
      "registrations",
      "matches",
      "standings",
      "knockout",
      "knockoutTies",
      "events",
      "draws",
      "pots",
    ]) {
      const snap = await db.collection(`tournaments/${t.id}/${sub}`).get();
      const docs = snap.docs.map((d) => ({
        id: d.id,
        path: d.ref.path,
        data: serialize(d.data()),
      }));
      await fs.writeFile(
        path.join(tDir, `${sub}.json`),
        JSON.stringify(
          { collection: `tournaments/${t.id}/${sub}`, count: docs.length, docs },
          null,
          2,
        ),
      );
      total += docs.length;
      if (docs.length) console.log(`[backup] tournaments/${t.id}/${sub}: ${docs.length}`);
    }
  }
  return total;
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Import after env load. tsx resolves src aliases via scripts/dev/tsconfig.json.
  const { getFirebaseAdminApp, getFirebaseAdminFirestore } = await import("@/lib/firebase/admin");
  const app = getFirebaseAdminApp();
  const projectId = app.options.projectId ?? process.env.FIREBASE_ADMIN_PROJECT_ID ?? "unknown";
  console.log(`[backup] Firebase project: ${projectId}`);
  const answer = await confirm(`Type the Firebase project id (${projectId}) to confirm backup: `);
  if (answer !== projectId) {
    throw new Error("Backup aborted: project id confirmation did not match.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(process.cwd(), "backups", stamp);
  await fs.mkdir(path.join(dir, "tournaments"), { recursive: true });

  const db = getFirebaseAdminFirestore();
  const collections = [
    "users",
    "publicProfiles",
    "tournaments",
    "rankings",
    "hallOfFame",
    "auditLogs",
    "announcements",
  ];
  const summary: Record<string, number> = {};
  for (const c of collections) summary[c] = await exportCollection(db, c, dir);
  summary.tournamentSubcollections = await exportTournamentSubcollections(db, dir);
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify({ projectId, createdAt: new Date().toISOString(), summary }, null, 2),
  );
  console.log(`[backup] Complete: ${dir}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[backup] Failed", error);
  process.exitCode = 1;
});
