"use client";

// GCC — browser Firebase SDK initialisation.
//
// Lazy singletons: nothing is initialised until a client component asks for it.
// Analytics is deliberately NOT initialised. Storage is not used on the Spark plan.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getPublicEnv } from "@/lib/config/env";

let clientApp: FirebaseApp | undefined;
let clientAuth: Auth | undefined;
let clientFirestore: Firestore | undefined;

/** Returns the singleton browser Firebase app, initialising it on first use. */
export function getFirebaseClientApp(): FirebaseApp {
  if (clientApp) {
    return clientApp;
  }

  if (getApps().length > 0) {
    clientApp = getApp();
    return clientApp;
  }

  const env = getPublicEnv();

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
