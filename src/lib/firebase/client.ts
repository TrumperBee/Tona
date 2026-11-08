"use client";

// GCC — browser Firebase SDK initialisation.
//
// Lazy singletons: nothing is initialised until a client component asks for it.
// Analytics is deliberately NOT initialised. Storage is not used on the Spark plan.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getPublicEnv, type PublicEnv } from "@/lib/config/env";

let clientApp: FirebaseApp | undefined;
let clientAuth: Auth | undefined;
let clientFirestore: Firestore | undefined;

/** A readable configuration failure for developers and operators. */
export class FirebaseClientConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FirebaseClientConfigError";
  }
}

function requireClientEnv(): PublicEnv {
  let env: PublicEnv;

  try {
    env = getPublicEnv();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new FirebaseClientConfigError(
      "Firebase is not configured in the browser. Check your .env.local file.\n\n" + detail,
      { cause: error },
    );
  }

  const missing = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", env.NEXT_PUBLIC_FIREBASE_API_KEY],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
    ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", env.NEXT_PUBLIC_FIREBASE_APP_ID],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new FirebaseClientConfigError(
      `Firebase browser configuration is incomplete. Missing: ${missing.join(", ")}. ` +
        "Add these public values to .env.local and restart the development server.",
    );
  }

  return env;
}

/** Returns the singleton browser Firebase app, initialising it on first use. */
export function getFirebaseClientApp(): FirebaseApp {
  if (clientApp) {
    return clientApp;
  }

  if (getApps().length > 0) {
    clientApp = getApp();
    return clientApp;
  }

  const env = requireClientEnv();

  clientApp = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  return clientApp;
}

/** Returns the singleton browser Firebase Auth instance. */
export function getFirebaseClientAuth(): Auth {
  if (!clientAuth) {
    clientAuth = getAuth(getFirebaseClientApp());
  }

  return clientAuth;
}

/**
 * Returns the singleton browser Firestore instance.
 * Clients only read from Firestore; all writes go through server routes.
 */
export function getFirebaseClientFirestore(): Firestore {
  if (!clientFirestore) {
    clientFirestore = getFirestore(getFirebaseClientApp());
  }

  return clientFirestore;
}
