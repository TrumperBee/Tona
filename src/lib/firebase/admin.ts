// GCC — server-only Firebase Admin SDK initialisation.
//
// The Admin SDK is the ONLY way application data is written. It bypasses
// Firestore Security Rules, so every call site must perform its own
// authentication, authorisation, Zod validation and audit logging.
//
// Initialisation happens once and is cached on globalThis so Next.js hot
// reloading does not create duplicate apps.
import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { getServerEnv } from "@/lib/config/env.server";

type FirebaseAdminGlobal = typeof globalThis & {
  __gccFirebaseAdminApp?: App;
};

/**
 * Converts escaped newlines from a single-line environment value into real
 * newlines, which the PEM parser requires.
 */
function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

function createAdminApp(): App {
  const env = getServerEnv();
  const privateKey = normalizePrivateKey(env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY is not a valid PEM private key. " +
        "Use the service account private key with escaped \\n newlines.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    },
    "gcc-admin",
  );
}

/**
 * Returns the singleton Admin app.
 *
 * @throws {EnvironmentError} when required server variables are missing.
 */
export function getFirebaseAdminApp(): App {
  const globalScope = globalThis as FirebaseAdminGlobal;

  if (globalScope.__gccFirebaseAdminApp) {
    return globalScope.__gccFirebaseAdminApp;
  }

  const existing = getApps()[0];
  if (existing) {
    globalScope.__gccFirebaseAdminApp = existing;
    return existing;
  }

  const app = createAdminApp();
  globalScope.__gccFirebaseAdminApp = app;
  return app;
}

/** Returns the Admin Firestore instance. Server-side use only. */
export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

/** Returns the Admin Auth instance. Server-side use only. */
export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
