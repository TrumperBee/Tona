# GCC E2E Smoke Tests

Playwright smoke suite for Phase 18B / Fix Batch 1 launch readiness.

## One-command run

```bash
npm run e2e
```

This command:

- refuses to run unless `.env.e2e` points at an approved Firebase emulator demo project;
- starts Firebase Auth + Firestore emulators (`demo-gcc`);
- builds the production app with `.env.e2e`;
- seeds the deterministic QA world (`npm run qa:seed`);
- starts the production server on `http://127.0.0.1:3100` pointed at emulators;
- runs Playwright desktop + 390px mobile Chromium projects;
- shuts down the server and exits with the Playwright exit code.

## Prerequisites

- Node/npm deps installed (`npm ci`)
- Java 21+ for Firebase emulators
- Playwright Chromium: `npx playwright install chromium`

## Seeded QA accounts

| Role        | Email                         |       Password | UID               |
| ----------- | ----------------------------- | -------------: | ----------------- |
| Super Admin | `superadmin@gcc-test.example` | `Passw0rd!123` | `e2e-super-admin` |
| Organiser   | `organiser@gcc-test.example`  | `Passw0rd!123` | `e2e-organiser`   |
| Player      | `player@gcc-test.example`     | `Passw0rd!123` | `e2e-player`      |
| Player 2    | `player2@gcc-test.example`    | `Passw0rd!123` | `e2e-player2`     |

All accounts are created only in Firebase emulators by `scripts/qa/seed-world.ts`. The seed script refuses to run without emulator hosts and an approved `demo-*` project id.

## Deterministic QA world

`npm run qa:seed` (also run by `npm run e2e`) creates:

- seeded users/profiles/gamer tags above;
- a public active tournament `QA Tournament` (`/tournaments/qa-tournament`) owned by the organiser;
- two registered players and one scheduled league match (`m1`) for organiser result-entry smoke;
- platform settings with maintenance mode off.

Tests can also reset state through `POST /api/test/seed` (available only in GCC_E2E + approved emulator project).

## Smoke coverage

- public pages render with no console/CSP/page errors
- register, login, logout flow
- player can register for tournament and withdraw
- organiser result entry preserves focus/scroll and records result
- maintenance mode blocks non-super-admin and shows maintenance page
- mobile 390px profile link reachable; protected routes redirect

## Safety guards

- `.env.e2e` contains dummy/non-secret values and Cloudflare Turnstile always-pass test keys.
- `GCC_E2E=1` and test-only switches are refused unless emulator hosts are configured and `FIREBASE_ADMIN_PROJECT_ID` is an approved demo project.
- `CLOUDINARY_MODE=mock` validates image size/magic bytes/auth but stores files in memory and serves them from a same-origin test route.
- When `RESEND_API_KEY` is absent in E2E capture mode, emails are recorded in-memory and exposed only to E2E test routes; no real email is sent.
- App Check is neutral/disabled in E2E; CSP remains active in report-only mode so CSP violations fail tests.

## Useful commands

```bash
npm run qa:seed   # seed emulator world (requires emulator env)
npm run e2e       # one-command harness
npm run e2e -- --project=chromium
npx playwright show-report
```
