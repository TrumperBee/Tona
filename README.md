# Global Champions Circuit (GCC)

**One Platform. Endless Competition.**

GCC is an independent, web-based tournament management platform for football gaming
communities — eFootball, EA SPORTS FC, Dream League Soccer and, later, other titles. It
runs competitions, generates fixtures, verifies results, calculates standings, manages
knockouts and preserves champions, player statistics and a Hall of Fame.

GCC is **not affiliated with UEFA** and never uses UEFA logos or branding.

> **Project status: Phase 3B - alignment and hardening patch.**
> Phase 1 delivered the scaffold. Phase 1B migrated the database stack to Firebase.
> Phase 2 implemented the Firestore data model, Security Rules, rules tests and server auth
> infrastructure. Phase 3 delivered the public design system and site skeleton. Phase 3B
> makes result handling admin-only, adds typed profile statistics and history, and hardens
> redirects, same-origin checks and security headers. No accounts, tournaments, fixtures,
> results or dashboards are implemented yet. Every page states which phase will build it.
> There is no fake data and no decorative functionality.

## Architecture principle: clients read, the server writes

- Firestore Security Rules deny **all** client writes, permanently.
- Every mutation goes through a Next.js route handler or server action using the Firebase
  Admin SDK, with authentication, authorisation, Zod validation and audit logging.
- Clients may read only what Security Rules explicitly allow.
- The project stays on the Firebase **Spark** plan: no Cloud Functions, no Firebase
  Storage and no Firebase Analytics.

## Tech stack

- Next.js 16 (App Router) + React + TypeScript (strict)
- Tailwind CSS with design tokens in `tailwind.config.ts`
- Firebase Authentication + Cloud Firestore
- Firebase Admin SDK for all writes (server only)
- Firestore Security Rules + emulator-based rules tests
- Zod validation, server-side guards and custom claims
- Vitest for unit tests
- ESLint + Prettier
- GitHub Actions CI: lint, typecheck, test, production build and rules tests
- Deployment target: Vercel
- Avatars: Cloudinary URLs stored on the profile (no Cloudinary SDK, no Firebase Storage)
- Graphics: HTML/CSS/SVG in the browser, exported to PNG

## Requirements

- Node.js 22 or newer (developed on Node 24)
- npm 10 or newer
- A Firebase project (default project id in `.firebaserc`: `tona-d6f56`)
- Java 21 (Temurin) only for `npm run test:rules` (the Firestore emulator is a Java process)

## Install and run

```bash
git clone <repository-url>
cd global-champions-circuit
npm install
```

Create your local environment file:

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Fill in the values in `.env.local`. Never commit it — it is git-ignored.

| Variable                                   | Exposure    | Purpose                                        |
| ------------------------------------------ | ----------- | ---------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Browser     | Firebase web API key                           |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Browser     | Firebase Auth domain (hostname)                |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Browser     | Firebase project id                            |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Browser     | Optional; unused while Storage is out of scope |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Browser     | Firebase messaging sender id                   |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Browser     | Firebase web app id                            |
| `NEXT_PUBLIC_SITE_URL`                     | Browser     | Canonical deployment URL                       |
| `NEXT_PUBLIC_EHUBMARKET_URL`               | Browser     | eHubMarket promotional link                    |
| `FIREBASE_ADMIN_PROJECT_ID`                | Server only | Service account project id                     |
| `FIREBASE_ADMIN_CLIENT_EMAIL`              | Server only | Service account email                          |
| `FIREBASE_ADMIN_PRIVATE_KEY`               | Server only | Service account private key (escaped `\n`)     |
| `SUPER_ADMIN_EMAIL`                        | Server only | The single Super Admin's email address         |
| `SESSION_COOKIE_MAX_AGE_DAYS`              | Server only | Session lifetime in days (default 5)           |

Environment validation is lazy: the app builds without secrets, but Firebase features will
report a clear configuration error until `.env.local` contains valid credentials.
Never paste secrets into chat or commit them.

## Scripts

| Script                 | Description                                                               |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run dev`          | Start the development server                                              |
| `npm run build`        | Production build                                                          |
| `npm run start`        | Serve the production build                                                |
| `npm run lint`         | ESLint                                                                    |
| `npm run typecheck`    | TypeScript, no emit                                                       |
| `npm run test`         | Vitest unit tests (no emulator or Java required)                          |
| `npm run test:watch`   | Vitest in watch mode                                                      |
| `npm run emulators`    | Start the Firebase Emulator Suite (Auth 9099, Firestore 8080, UI enabled) |
| `npm run test:rules`   | Run Firestore rules tests against the emulators (requires Java 21)        |
| `npm run rules:deploy` | Deploy Firestore rules to the default project                             |
| `npm run format`       | Prettier write                                                            |
| `npm run format:check` | Prettier check                                                            |

Firestore rules deny all client writes and allow reads only where documented in
`docs/02-DATA-MODEL.md`. Rules tests live in `tests/rules/` and are documented in
`tests/rules/README.md`.

## Session endpoints

| Endpoint                   | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `POST /api/auth/session`   | Exchange a Firebase ID token for an http-only session cookie |
| `DELETE /api/auth/session` | Clear the cookie and revoke refresh tokens                   |

Both methods reject cross-origin requests. Every future state-changing route must call
`assertSameOrigin()` from `src/lib/security/same-origin.ts` before reading a body.
`NEXT_PUBLIC_SITE_URL` is optional in development (it falls back to
`http://localhost:3000`) and required for a production build.

## Project layout

```
src/
  app/            Next.js routes: public, auth, dashboard, organiser, super-admin, api
  components/     UI primitives, layouts, feature components, shared placeholders
  lib/
    engine/       PURE competition engine (no framework, no database)
    firebase/     Browser SDK, Admin SDK (server-only), collection paths
    auth/         Roles, session cookie, guards, role/status administration, audit
    validation/   Zod schemas
    audit/        Append-only audit log writer
    rate-limit/   Firestore-backed fixed-window limiter
    config/       Validated env, site identity, games, formats
    ...           whatsapp, graphics, notifications, utils
  types/          Shared domain types and Firestore document types
  proxy.ts        Next.js 16 proxy: cookie-presence navigation guard only
firebase.json     Firestore rules/indexes and emulator ports
firestore.rules   Security Rules (deny all client writes)
firestore.indexes.json
.firebaserc       Default Firebase project: tona-d6f56
docs/             Product, architecture, data model, engine, security, roadmap, design, decisions
tests/            Unit tests now; rules and end-to-end tests later
```

## Documentation

Start with [`docs/00-PROJECT-VISION.md`](docs/00-PROJECT-VISION.md), then:

- [Architecture](docs/01-ARCHITECTURE.md)
- [Firestore data model](docs/02-DATA-MODEL.md)
- [Competition engine](docs/03-COMPETITION-ENGINE.md)
- [Security](docs/04-SECURITY.md)
- [Roadmap](docs/05-ROADMAP.md)
- [Design system](docs/06-DESIGN-SYSTEM.md)
- [Decision log](docs/DECISIONS.md)

## Contributing rules

1. Clients read; the server writes. Never allow a client write in Firestore rules.
2. Never trust roles, scores or permissions from the client.
3. Competition calculations run on the server inside the pure engine.
4. Security rules and indexes are versioned files deployed with the Firebase CLI.
5. Only `NEXT_PUBLIC_*` variables may reach the browser.
6. Validate all server input with Zod.
7. Audit important admin actions and result changes.
8. Never hard-delete competition records.
9. Do not use Cloud Functions, Firebase Storage or Analytics on the Spark plan.
10. No fake data or placeholder features presented as working.
