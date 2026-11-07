# GCC — Decision Log

Architecture decisions are recorded here with context and consequences. New decisions are
appended; superseded decisions are marked, not deleted.

---

## ADR-001 — Independent branding, not affiliated with UEFA

**Date:** 2026-11-07
**Status:** Accepted

**Context.** GCC launches with a competition structure modelled on the modern 36-team
league phase. That structure is attractive, but the platform is an independent product for
football gaming communities.

**Decision.** GCC uses its own name, wordmark, palette and competition naming. It never
uses UEFA logos, marks, trophies or protected branding, and displays an independence
notice in the footer. The launch format is described descriptively (league phase,
play-offs, Round of 16).

**Consequences.** All brand assets must be original. Marketing must not imply endorsement.
Legal review is required before public launch (Phase 3).

---

## ADR-002 — One launch format, stored as configuration

**Date:** 2026-11-07
**Status:** Accepted

**Context.** The product must support more competition formats later without rewriting the
core engine.

**Decision.** Launch with exactly one format, `ucl-league-phase-36`, defined as typed data
in `src/lib/config/formats.ts`. The engine consumes a format definition rather than
hardcoding 36 teams or 8 matchdays. Additional formats will extend the `CompetitionFormat`
union.

**Consequences.** The engine API must take a format and participant set as inputs. The UI
and database reference format ids. Only the launch format is tested at launch; additional
formats require their own engine tests.

---

## ADR-003 — Super Admin identified only by a server-side environment variable

**Date:** 2026-11-07
**Status:** Accepted

**Context.** The platform owner needs unconditional authority, but an editable
"super_admin" role row creates a privilege-escalation target and a bootstrap problem.

**Decision.** The sole Super Admin is the authenticated user whose email matches
`SUPER_ADMIN_EMAIL`. The value lives only in server-side environment configuration and is
validated by `env.server.ts`. It is never hardcoded in source, never sent to the browser
and never assignable through the UI. Enforcement happens in server guards and database
policies.

**Consequences.** Changing the owner is an environment change, not a database edit.
Policies that need Super Admin identity must resolve it server-side or through a
service-role path with explicit checks. No second Super Admin exists by design. See
ADR-010 for the custom-claim enforcement mechanism introduced in Phase 1B.

---

## ADR-004 — Competition engine as pure TypeScript

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Fixtures, standings and qualification are the most important calculations in
the product and must be trustworthy, reproducible and testable.

**Decision.** `src/lib/engine/` contains pure TypeScript only: no database, framework,
environment or I/O imports. Inputs are plain data; output is deterministic given a seed.
Generation and validation are separate. The engine runs on the server; clients never
produce authoritative competition state.

**Consequences.** The engine can be unit-tested exhaustively with Vitest. Persistence and
authorisation live in server code around it. Randomised draws must record their seed and
output for auditing. Lint enforcement of import boundaries is planned for Phase 18.

---

## ADR-005 — Database changes only through SQL migrations

**Date:** 2026-11-07
**Status:** Superseded by ADR-008

**Context.** The original database platform allows schema and policy edits through a
dashboard. Those edits are invisible to version control and impossible to reproduce.

**Decision.** All schema, policy, trigger and function changes are written as SQL files in
`supabase/migrations/`. No manual dashboard edits in any environment. Generated TypeScript
types are committed after migrations.

**Consequences.** Every environment is reproducible. Reviews include SQL. Hotfixes follow
the same path. Local development uses the Supabase CLI once Phase 2 configures it.

> Historical entry. This decision applied while GCC used PostgreSQL with RLS. It no longer
> governs the project; see ADR-008 for the Firestore replacement.

---

## ADR-006 — Tailwind CSS v3 for the mandated `tailwind.config.ts`

**Date:** 2026-11-07
**Status:** Accepted

**Context.** The scaffold brief requires design tokens in `tailwind.config.ts` and
`globals.css`. The current `create-next-app` template installs Tailwind v4, which is
CSS-first and does not use a JS/TS config by default.

**Decision.** Use Tailwind CSS v3.4 with `tailwind.config.ts` as the single source of
truth for the palette, fonts and shadows, plus `postcss` and `autoprefixer` as build
dependencies. `globals.css` mirrors the core colours as CSS variables for inline SVG and
third-party use.

**Consequences.** The required configuration file is real and typed. Upgrading to
Tailwind v4 later requires migrating tokens to `@theme` and is deliberately deferred.
`postcss` and `autoprefixer` are additional dev dependencies required by Tailwind v3.

---

## ADR-007 — Split environment validation into public and server modules

**Date:** 2026-11-07
**Status:** Accepted

**Context.** The brief asks for a Zod-validated environment loader that separates
server-only variables and guarantees server secrets can never be imported by client
components, while public `NEXT_PUBLIC_*` values must remain usable in the browser.

**Decision.** `src/lib/config/env.ts` validates public variables and is safe to import
anywhere. `src/lib/config/env.server.ts` imports `server-only` and validates
`SUPABASE_SERVICE_ROLE_KEY` and `SUPER_ADMIN_EMAIL`. Validation is lazy so builds do not
require secrets. `server-only` is the only dependency added beyond the brief's list.

**Consequences.** A client component that imports the server module fails the build. The
server module imports the public module, so server code has one validated environment
object. Adding a server secret means adding it to the server schema only.

> The variable names above are historical. Phase 1B replaced them with Firebase Admin
> credentials (ADR-008); the public/server module split and lazy validation remain in
> force.

---

## ADR-008 — Firebase replaces the original database stack

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Phase 1 used PostgreSQL, Auth, RLS and Storage from Supabase. The product
owner has decided to abandon that stack completely and use Firebase Authentication with
Cloud Firestore. The project must stay on the Firebase Spark (free) plan.

**Decision.** Remove Supabase entirely. Use Firebase Authentication for identity and Cloud
Firestore for data, accessed from Next.js server code through the Firebase Admin SDK. The
browser uses the Firebase web SDK for authentication and permitted reads only.

Spark-plan constraints are part of the decision:

- No Cloud Functions.
- No Firebase Storage.
- No Firebase Analytics initialisation.

Firestore Security Rules deny all client writes permanently. Every write is performed by
Next.js route handlers or server actions using the Admin SDK after authentication,
authorisation, Zod validation and audit logging. Clients may read only what rules
explicitly permit.

**Consequences.** The PostgreSQL schema outline and SQL migration policy are replaced by
the Firestore data model document and versioned rules/indexes. ADR-005 is superseded.
Profile-picture/file uploads are deferred because Storage is unavailable. Security rules
must be tested with the emulator suite. The Admin SDK bypasses rules, so server-side
checks and code review carry more responsibility.

---

## ADR-009 — Plain pots without country restrictions, with admin shuffle

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Pot allocation could add country or region restrictions to avoid certain
clashes. Such constraints complicate the draw, create unsatisfiable edge cases and are not
required for community competition.

**Decision.** The launch format uses four plain pots of nine with **no country
restrictions**. Organisers may shuffle participants between pots before fixtures are
generated. Every shuffle is recorded in the audit log with the actor, timestamp and
resulting assignments.

**Consequences.** Fixture generation has fewer constraints. Fairness depends on seeding
and transparent organiser action. The engine still validates pot sizes, participant
uniqueness and all fixture rules. Admin shuffles must not occur after fixtures are
published without an explicit regeneration and audit entry.

---

## ADR-010 — Super Admin via `SUPER_ADMIN_EMAIL` and custom claims

**Date:** 2026-11-07
**Status:** Accepted (claim shape amended by ADR-015)

**Context.** Firestore Security Rules need a fast, trustworthy way to recognise the
platform owner without exposing the owner's email address or allowing a role document to
be edited into privilege escalation.

**Decision.** `SUPER_ADMIN_EMAIL` remains the single source of truth. During authentication
and session issuance, the server compares the verified email with that value and sets a
`superAdmin: true` custom claim on the Firebase Auth user. Other accounts have the claim
removed. Server guards and Firestore rules check the claim; the email itself is never sent
to the client and never hardcoded.

**Consequences.** Claim changes take effect when the ID token refreshes; session issuance
and refresh must keep the claim in sync. Changing the owner requires an environment change
plus a claim update. No database document can grant Super Admin status. Ordinary roles
(`tournamentAdmin`, `participant`) follow the same claims-based enforcement model.

> Phase 2 replaces the boolean `superAdmin` claim with the single `role` claim described in
> ADR-015. The `SUPER_ADMIN_EMAIL` rule and custom-claim enforcement remain unchanged.

---

## ADR-015 — One `role` custom claim is the role authority

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Phase 1B used a boolean `superAdmin` claim while planning a separate role
model. Phase 2 needs one claim that is easy to check in Security Rules and server guards:
`user`, `organiser` or `super_admin`.

**Decision.** The custom claim `role` is the only role authority. It is one of `user`,
`organiser` or `super_admin`. Server code writes it with `setCustomUserClaims`; the legacy
`superAdmin` boolean is removed when claims are updated. `super_admin` is granted only to
the configured, verified `SUPER_ADMIN_EMAIL` account by
`assertRoleAssignmentAllowed`. Guards and Security Rules read `role` from the verified
token; `requireSuperAdmin` additionally compares the verified email with the configured
owner address.

`assertRoleAssignmentAllowed(targetEmail, targetEmailVerified, role, superAdminEmail)`
takes the configured owner email as an explicit argument so the policy stays pure and
unit-testable. Omitting it fails closed for `super_admin`.

**Consequences.** There is one role to audit and one shape for rules to check. A stale
`super_admin` claim is stripped at session exchange if the email no longer matches or is
unverified. Role changes revoke refresh tokens, so the client must refresh its ID token
before the new role is active.

---

## ADR-016 — Session exchange with revocation checks

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Firebase ID tokens are short-lived and intended for client use. Server
components and route handlers need an http-only session that can be revoked.

**Decision.** `POST /api/auth/session` verifies a Firebase ID token, checks the Auth user
and private account status, applies the Super Admin rule, creates a Firebase session cookie
and returns the role and a `refreshRequired` flag. The cookie is http-only, `Secure` in
production, `SameSite=Lax`, path `/`, with a lifetime from
`SESSION_COOKIE_MAX_AGE_DAYS`. Guards verify it with `checkRevoked: true`.
`DELETE /api/auth/session` clears the cookie and revokes refresh tokens.

If a privileged claim must be removed, the route revokes the target's tokens and does not
issue a new cookie; the client must refresh and sign in again. If a claim is added, a
cookie may be issued from the old token, but `refreshRequired` tells the client to refresh
before relying on the new role.

**Consequences.** Role/status changes take effect after token refresh. The server must
handle revoked and disabled sessions as unauthenticated. Session exchange is rate limited.

---

## ADR-017 — Read-only rules with draft isolation

**Date:** 2026-11-07
**Status:** Accepted

**Context.** The data model mixes public display data, private contact data and
unpublished competition planning. A single collection-level policy would leak drafts or
private data.

**Decision.** Rules implement the read table in `docs/02-DATA-MODEL.md` exactly. Draft and
suspended tournaments and all their subcollections are hidden from the public. Matches
become public only for published statuses. Draws become public only after confirmation.
Fixture drafts are owner/Super Admin only. Disputes require match participation, ownership
or Super Admin. `gamerTags` and `rateLimits` have no client read. Every write is denied.

**Consequences.** Queries may need explicit status filters to satisfy rules. Server routes
remain the only write path. Rules tests assert both allowed reads and denied reads/writes.

---

## ADR-018 — Firestore-backed fixed-window rate limiting

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Vercel serverless instances do not share memory, so an in-process limiter
cannot enforce a shared budget. Cloud Functions are not available on the Spark plan.

**Decision.** Rate limits use Firestore documents under `rateLimits/{sha256(key)}` and a
transaction for each check. The window is fixed. Denied requests do not extend the window.
The session exchange is the first endpoint to use it. Limitations (boundary bursts,
transaction latency, cleanup, key scoping) are documented in the module and security doc.

**Consequences.** Rate limiting requires Firestore availability and Admin credentials. It
is abuse control, not a substitute for a WAF or Firebase Auth quotas. Counter documents
are server-only and need eventual cleanup.

---

## ADR-019 — Rules tests use a separate Vitest configuration

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Rules tests need the Firebase Emulator Suite, which requires Java. A plain
`npm test` must remain fast and must not fail on a machine without Java.

**Decision.** Unit tests use `vitest.config.ts` and `src/**/*.test.ts`. Rules tests live in
`tests/rules/` and use `vitest.rules.config.ts`. `npm run test:rules` starts the Firestore
and Auth emulators through `firebase emulators:exec`, runs the rules suite and shuts them
down. `tests/rules/README.md` documents the Java requirement.

**Consequences.** CI can run unit tests everywhere and rules tests in a Java-capable job.
Rules tests share one emulator and run serially.

---

## ADR-011 — Rename `middleware.ts` to `proxy.ts`

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Next.js 16 deprecates the `middleware` file convention and renames it to
`proxy`. Keeping the old name caused a build warning.

**Decision.** Use `src/proxy.ts` and export a `proxy` function. It performs a lightweight
check for the presence of the session cookie on protected route groups and redirects to
`/login` when it is absent.

**Consequences.** The build warning is removed. The proxy is a navigation guard only: it
does not validate the session and is never treated as authorisation. Real session, role
and ownership checks run in server guards and route handlers from Phase 2.

---

## ADR-012 — Password policy 10–128 characters

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Passwords are verified and hashed by Firebase Authentication. The server
still validates registration and reset input with Zod.

**Decision.** Require 10–128 characters. Do not impose character-composition rules
(uppercase, symbols, etc.); length is the primary strength control.

**Consequences.** The policy is enforced server-side and mirrored in client validation for
usability. Firebase Authentication remains the authority on credential hashing. Existing
accounts created under another policy are unaffected.

---

## ADR-013 — Server-write model

**Date:** 2026-11-07
**Status:** Accepted

**Context.** A direct-from-browser Firestore write model would require complex rules per
collection and would still struggle to enforce score verification, audit logging and
multi-document consistency.

**Decision.** Firestore Security Rules deny **all** client writes. The browser may read
only where rules allow. Every mutation is executed by server code with the Admin SDK,
following a fixed sequence: authenticate, authorise, validate with Zod, write with server
timestamps, audit important actions.

**Consequences.** The app requires a server connection to write (no offline writes).
Server route handlers become the security boundary and must be reviewed carefully. The
Admin SDK bypasses rules, so tests must cover each write path's authorisation. Read-heavy
pages still read Firestore directly to keep server load low.

---

## ADR-014 — Tournament timezone defaults to Africa/Nairobi

**Date:** 2026-11-07
**Status:** Accepted

**Context.** Competitions need one unambiguous display timezone for fixtures, deadlines
and announcements, while the server must store and compare times consistently.

**Decision.** Every tournament defaults to `Africa/Nairobi`. The timezone is stored as an
IANA identifier string (not a UTC offset) and can be changed in tournament settings. Server
calculations and stored timestamps use UTC; display converts to the tournament timezone.

**Consequences.** Daylight-saving changes in other zones are handled correctly by IANA
data. All date formatting must take a tournament timezone rather than a hardcoded offset.
Existing utility defaults are reviewed in Phase 3/8.
