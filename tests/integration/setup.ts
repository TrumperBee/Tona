// GCC - integration test environment setup.
//
// `firebase emulators:exec` exports the emulator hosts. These defaults make a
// direct `vitest --config vitest.integration.config.ts` run work too. Public
// Firebase values are dummy strings: nothing in these tests talks to production.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

process.env.FIREBASE_ADMIN_PROJECT_ID ??= process.env.GCLOUD_PROJECT ?? "tona-d6f56";
process.env.SUPER_ADMIN_EMAIL ??= "owner@example.com";
process.env.FIREBASE_ADMIN_CLIENT_EMAIL ??= "integration@example.com";
process.env.FIREBASE_ADMIN_PRIVATE_KEY ??=
  "-----BEGIN PRIVATE KEY-----\\nintegration-test-placeholder\\n-----END PRIVATE KEY-----";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "integration-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= "integration.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= process.env.FIREBASE_ADMIN_PROJECT_ID;
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= "000000000000";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= "1:000000000000:web:integration";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
