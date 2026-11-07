// GCC — Firebase barrel for client-safe exports.
// Server code must import the Admin SDK directly from "./admin" so the
// `server-only` guard is never bypassed.
export { getFirebaseClientApp, getFirebaseClientAuth, getFirebaseClientFirestore } from "./client";
export { COLLECTIONS, DOCUMENTS, SUBCOLLECTIONS, paths, userNotificationPath } from "./paths";
export type { CollectionName, SubcollectionName } from "./paths";
