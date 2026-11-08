# Firestore Rules Tests

These tests run against the Firebase Emulator Suite using
`@firebase/rules-unit-testing`.

## Requirements

- **Java 21 (Temurin) or newer** on `PATH`. The Firestore emulator is a Java process.
  Verify with `java -version`.
- Firebase CLI installed through the project's dev dependency (no global install
  required).

## Run

```bash
npm run test:rules
```

The script starts the Firestore (port 8080) and Auth (port 9099) emulators,
runs Vitest with `vitest.rules.config.ts`, and shuts the emulators down afterwards.

Plain `npm test` intentionally does **not** include these tests; it must not
require Java or an emulator.

## What is covered

- Anonymous users cannot read private collections.
- Owners can read their private profile, notifications and memberships only.
- Public profiles, public history, public tournaments and public subcollections are readable.
- Draft and suspended tournaments remain hidden from the public.
- An organiser can read their own draft but not another organiser's draft.
- Result reports are visible only to the reporter, the tournament owner and the Super Admin.
- Collection-group match and registration queries cannot leak draft or suspended tournaments.
- Audit logs and platform stats are Super Admin-only.
- No client role can write to any collection.
