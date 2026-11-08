# GCC — Architecture

> Status: Phase 4. This document defines the rules every phase must follow.

## 1. Fixed technology stack

| Layer          | Technology                                                                            |
| -------------- | ------------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router), React, TypeScript strict mode                                |
| Styling        | Tailwind CSS with tokens in `tailwind.config.ts`                                      |
| Authentication | Firebase Authentication                                                               |
| Database       | Cloud Firestore                                                                       |
| Authorisation  | Firestore Security Rules + server-side guards and custom claims                       |
| File storage   | Cloudinary for avatars, through server-only credentials. Firebase Storage is not used |
| Server compute | Next.js route handlers and server actions on Vercel. No Cloud Functions               |
| Validation     | Zod (server-side, always)                                                             |
| Unit tests     | Vitest                                                                                |
| Rules tests    | `@firebase/rules-unit-testing` against the Firebase Emulator Suite                    |
| Quality        | ESLint + Prettier                                                                     |
| CI             | GitHub Actions (lint, typecheck, unit tests, build, rules and integration tests)      |
| Hosting        | Vercel                                                                                |
| Graphics       | HTML/CSS/SVG in the browser, exported to PNG with `html-to-image`                     |

Deliberate Spark-plan constraints: no Cloud Functions, no Firebase Storage and no
Firebase Analytics. The web app initialises Auth and Firestore only.

## 2. Non-negotiable architecture rules

1. **Clients read, the server writes.** Firestore Security Rules deny **all** client
   writes. Every mutation — registration, results, fixtures, standings, roles,
   notifications — goes through a Next.js route handler or server action using the
   Firebase Admin SDK.
2. **Never trust the client.** Roles, scores, permissions, tournament ownership and
   competition calculations are verified or produced on the server. Hiding a button is
   never an authorisation control.
3. **Least-privilege reads.** Clients may read only what Security Rules explicitly allow.
   Private data (contact details, audit logs, unpublished drafts) is not client-readable.
4. **Every write is validated and auditable.** The server authenticates the session,
   authorises the action, parses input with Zod, writes with the Admin SDK, records a
   server timestamp and appends an audit entry for important actions.
5. **The competition engine is pure TypeScript.** Everything in `src/lib/engine/` must be
   free of Firebase, database, framework, environment and I/O imports. It must be
   deterministic given its inputs and fully unit-testable.
6. **Firebase configuration is versioned.** Security rules (`firestore.rules`) and
   indexes (`firestore.indexes.json`) are reviewed and deployed from the repository, never
   edited ad hoc in the console for production.
7. **Secrets stay on the server.** Only `NEXT_PUBLIC_*` variables reach the browser.
   Admin credentials are validated in `src/lib/config/env.server.ts`, guarded by
   `server-only`, and used only by `src/lib/firebase/admin.ts`.
8. **Formats are configuration.** Competition formats are typed data in
   `src/lib/config/formats.ts`; the engine reads them. Only `ucl-league-phase-36` is
   implemented at launch.
9. **No hard deletes.** Competition records, results, standings and audit entries are
   retained permanently; corrections are new state plus an audit entry.
10. **Validate input with Zod on the server.** Schemas live in `src/lib/validation/`.
11. **No fake functionality.** No placeholder data, dead controls or features presented as
    working.

## 3. Layer diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ BROWSER                                                              │
│  React client components · forms · HTML/CSS/SVG graphics → PNG       │
│  Firebase Auth + Firestore SDK (READ ONLY)                           │
│  Holds only NEXT_PUBLIC_* configuration.                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS (server actions / route handlers)
┌───────────────────────────────▼──────────────────────────────────────┐
│ NEXT.JS SERVER (Vercel)                                              │
│  Route handlers · server actions · server components                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ AUTHORISATION: Firebase session + custom claims + ownership    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ VALIDATION: Zod schemas                                        │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ COMPETITION ENGINE (pure TypeScript, server/test imports only):│  │
│  │  pots · fixtures · validation · standings · qualification      │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ FIREBASE ADMIN SDK (server-only): writes, claims, audit        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Server-only secrets: FIREBASE_ADMIN_*, SUPER_ADMIN_EMAIL            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Admin SDK (privileged, bypasses rules)
┌───────────────────────────────▼──────────────────────────────────────┐
│ FIREBASE                                                             │
│  Firebase Authentication · Cloud Firestore · Security Rules          │
│  Deny all client writes · least-privilege reads · audit collections  │
└──────────────────────────────────────────────────────────────────────┘

             ┌──────────────────────────────────────────┐
             │ ENGINE LIBRARY (src/lib/engine/)         │
             │ Pure, framework-free, deterministic      │
             │ Imported by server code and Vitest only  │
             └──────────────────────────────────────────┘
```

### Write flow (e.g. enter an admin result)

1. Client submits input to a route handler or server action.
2. Server authenticates the session (Firebase session cookie, http-only).
3. Server authorises: custom claims, role and tournament ownership.
4. Server parses input with the relevant Zod schema.
5. Server calls the pure engine to recompute standings/qualification.
6. Server writes in a Firestore transaction with the Admin SDK and appends an audit entry.
7. Client reads the new authoritative state allowed by Security Rules.

The client never sends a trusted role, computed standing, "confirmed" flag or write
capability.

### Read flow

1. Browser signs in with Firebase Auth.
2. Firestore SDK reads only collections/documents permitted by Security Rules.
3. Sensitive fields live in server-only subcollections or collections with no client read
   access.
4. If a read needs joins or server-side filtering, it goes through a read-only route
   handler; the client still never writes.

## 4. Folder responsibilities

### `src/app/`

| Folder          | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `(public)`      | Public website, navbar/footer shell, discovery pages    |
| `(auth)`        | Sign in, registration, verification, password reset     |
| `(dashboard)`   | Participant area                                        |
| `(organiser)`   | Tournament Admin area                                   |
| `(super-admin)` | Platform owner area                                     |
| `api/`          | Route handlers (health now; reads and writes later)     |
| root files      | Global layout, 404, error boundary, loading, global CSS |

Route groups do not appear in URLs. Layouts and route handlers are the place for
server-side access checks from Phase 2 onward.

### `src/components/`

Presentation only. `ui/` primitives, `layout/` shells, feature folders
(`tournament/`, `fixtures/`, `standings/`, `graphics/`, `marketplace/`) and `shared/`.
No component writes data. Read hooks are added later.

### `src/lib/`

| Folder           | Responsibility                                            |
| ---------------- | --------------------------------------------------------- |
| `engine/`        | Pure competition logic — no framework, no I/O             |
| `firebase/`      | Browser SDK, Admin SDK, collection path constants         |
| `auth/`          | Roles, session cookie, guards, role/status administration |
| `validation/`    | Zod schemas                                               |
| `whatsapp/`      | E.164 helpers, templates, click-to-chat links             |
| `graphics/`      | PNG export helpers                                        |
| `audit/`         | Audit log writer                                          |
| `notifications/` | Notification domain                                       |
| `rate-limit/`    | Rate limiting policies                                    |
| `config/`        | Validated env, site identity, games, formats              |
| `utils/`         | Small pure utilities (`cn`, `dates`, `slug`)              |

### Other files and folders

- `src/proxy.ts` — Next.js 16 Proxy. Cookie-presence navigation guard only; not
  authorisation.
- `src/types/` — shared TypeScript types and Firestore document shapes.
- `src/hooks/` — client hooks (later phases).
- `firestore.rules` — Security Rules. Client writes are denied permanently.
- `firestore.indexes.json` — composite indexes, deployed from the repository.
- `firebase.json` — rules/indexes wiring and emulator ports.
- `.firebaserc` — default project `tona-d6f56`.
- `tests/` — unit tests and `tests/rules/` Firestore rules tests; end-to-end later.
- `docs/` — product, architecture, data model, engine, security, roadmap, design,
  decisions.
- `public/brand/` — official brand assets (Phase 3).

## 5. Environment handling

- `src/lib/config/env.ts` validates public Firebase web configuration, the site URL and
  the eHubMarket URL. It reads each variable explicitly so Next.js can inline
  `NEXT_PUBLIC_*` values. A blank `NEXT_PUBLIC_SITE_URL` falls back to
  `http://localhost:3000` in development; production builds require a valid absolute URL.
- `src/lib/config/env.server.ts` imports `server-only` and validates
  `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY`, `SUPER_ADMIN_EMAIL` and
  `SESSION_COOKIE_MAX_AGE_DAYS` (default 5).
- The Admin SDK converts escaped `\n` sequences in the private key to real newlines and
  initialises once, cached on `globalThis` for hot-reload safety.
- Builds do not require secrets: validation happens when an SDK is initialised, not at
  module import.

## 6. Testing strategy

- Engine tests are pure unit tests in `src/lib/engine/__tests__/` (Phase 10 onward).
- Validation and utility tests live beside their modules or in the same test folder.
- Security Rules are tested with `@firebase/rules-unit-testing` against the emulator
  suite: client reads allowed only where intended, **all client writes denied**. The
  emulator requires Java 21 (Temurin).
- Run `npm run test:rules` (starts emulators and runs the rules suite). Plain `npm test`
  runs unit tests only and never needs Java.
- CI runs lint, typecheck, unit tests and a production build with dummy public values on
  every push and pull request. A separate Java 21 job runs the rules tests.
- State-changing route tests cover same-origin rejection; redirect sanitiser tests cover
  common open-redirect bypasses.
- End-to-end tests arrive in Phase 18.

## 7. Deployment model

Vercel hosts the Next.js application. Firebase hosts Authentication and Firestore.
Security rules and indexes are deployed with the Firebase CLI from the repository.
Production Admin credentials exist only in Vercel's server environment. The client never
receives a service account credential. No secret is ever committed.
