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
**Status:** Superseded by ADR-047 (email + uid pinning)

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
**Status:** Superseded by ADR-047 (the grant rule now needs email + uid)

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
Fixture drafts are owner/Super Admin only. Result reports are readable by the reporter, the
tournament owner and the Super Admin, and cannot change a result. `gamerTags` and `rateLimits` have no client read. Every write is denied.

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
**Status:** Superseded by ADR-045

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

---

## ADR-020 — Results are entered by admins only

**Date:** 2026-11-08
**Status:** Accepted

**Context.** Allowing players to submit scores created a provisional-result state, a
confirmation step, a dispute workflow and several match statuses. Review showed that this
made the authoritative result ambiguous and gave players a path into result data.

**Decision.** Results are entered strictly by the tournament owner or the Super Admin. A
match is either `scheduled` or `completed`. `MatchResult` records the score, `enteredBy`,
`enteredAt`, optional last-editor fields and an `editCount`. Corrections require a reason and
are audit-logged with before/after values. Players only read results.

**Consequences.** `pendingResult`, `deadlineAt`, the old match statuses and participant result
schemas are removed. The result entry route is the only write path for scores, and every
correction leaves an audit trail. A future player-facing concern uses the result-report
channel instead of a result workflow.

---

## ADR-021 — "Report a problem" replaces player disputes

**Date:** 2026-11-08
**Status:** Accepted

**Context.** The dispute model implied that players could contest and potentially change an
official result. The product needs a simple way for a player to ask an admin to review a
recorded result, without creating a parallel decision process.

**Decision.** Replace `tournaments/{id}/disputes` with
`tournaments/{id}/resultReports`. A report carries `matchId`, `reportedBy`, `reportedByTag`,
`reason` (max 500 characters), `status` (`open`, `resolved`, `dismissed`), `adminNote`,
`resolvedBy`, `resolvedAt` and `createdAt`. It is readable by the reporter, the tournament
owner and the Super Admin. Writes remain deny-all and are server-only.

**Consequences.** Routes and navigation are renamed to `result-reports`; the organiser and
Super Admin pages explain that a report is not an official result change. Any correction is
made through the admin result workflow and audit log.

---

## ADR-022 — Profile fields for community, favourite club and avatars

**Date:** 2026-11-08
**Status:** Accepted

**Context.** Public profiles need enough identity for community competition without exposing
private contact data. The review also asked for typed career statistics and a stable
lowercase gamer tag for prefix search.

**Decision.** Add `community` (optional, max 40), `favouriteClub` (optional, max 40, plain
text, no logos), `avatarUrl`, `avatarPublicId` and `gamerTagLower` to profiles. Replace the
flat public aggregates with a typed `stats` object: `overall` plus a partial `byGame` map, each
with tournaments, played, wins, draws, losses, goalsFor, goalsAgainst, titles, and per-game
rating/ratedMatches. Defaults are zeros and `rating: null`. Add owner-read
`users/{uid}/memberships/{tournamentId}` and public-read
`publicProfiles/{uid}/history/{tournamentId}`.

**Consequences.** Phase 17 computes the statistics; Phase 3B defines the shape. The users
`role` field stays display-only; custom claims remain the only authority. Collection-group
rules and indexes keep hidden tournaments out of player history queries.

---

## ADR-023 — Firebase default hosted email action handler

**Date:** 2026-11-08
**Status:** Accepted

**Context.** The application had an `/auth/callback` route that returned 501 and did not
verify Firebase action codes. Firebase Authentication already hosts email verification,
password reset and email-change pages.

**Decision.** Use Firebase's default hosted email action handler for all email actions. Delete
`/auth/callback` and every reference to it. The application never receives or verifies
Firebase email action codes.

**Consequences.** There is one less route to secure, and email action links work without
custom code. Branded email templates and a custom action handler can be revisited later if
Firebase supports them without a Cloud Function. Only password reset and email-change links
are used now; email verification was removed in ADR-046.

---

## ADR-024 — Same-origin guard and security headers; CSP deferred to Phase 18

**Date:** 2026-11-08
**Status:** Accepted

**Context.** Cookie-authenticated state-changing routes need CSRF defence beyond
`SameSite=Lax`. Redirect parameters also need a reusable, testable sanitiser. A full CSP is
risky before Firebase, Cloudinary and Next.js asset origins are finalised.

**Decision.** Add a pure `safeRedirectPath()` used by the proxy and login redirect builder,
and a reusable `assertSameOrigin(request)` helper applied to `/api/auth/session`. Every future
POST/PATCH/PUT/DELETE route must call the helper. Add `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and a restrictive
`Permissions-Policy` in `next.config.ts`. Defer a Content-Security-Policy to Phase 18, when it
can explicitly allow Firebase and Cloudinary.

**Consequences.** Cross-origin state-changing requests are rejected with 403, and open-redirect
tricks are unit-tested. CSP remains an explicit Phase 18 deliverable rather than an
under-specified header that could break authentication or avatars.

---

## ADR-025 — Cloudinary for avatars

**Date:** 2026-11-08
**Status:** Accepted

**Context.** The project stays on the Firebase Spark plan and does not use Firebase Storage.
Profiles still need user avatars, and the review asked for a concrete storage decision.

**Decision.** Store Cloudinary delivery URLs in `avatarUrl` and Cloudinary public ids in
`avatarPublicId`. Do not add the Cloudinary SDK as a dependency; server code treats the values
as opaque validated URLs/ids and can delete or replace an asset through a small server route
when avatar upload is implemented.

**Consequences.** No Firebase Storage or Cloudinary client dependency is added. Avatars are
plain public URLs on `publicProfiles`, while `avatarPublicId` stays on the private user
document. Image upload, transformation and cleanup are implemented in Phase 4.

---

## ADR-026 — Server-first atomic registration and immutable gamer tags

**Date:** 2026-11-08
**Status:** Accepted

**Context.** Firebase Auth creates the account before Firestore can reference its UID, so a
failure part-way through registration could leave an Auth user with no profile or a reserved
gamer tag with no owner. Gamer tags also anchor results and history, so allowing a rename
would rewrite competitive identity.

**Decision.** `POST /api/auth/register` validates the payload first, then creates the Auth
user, then runs one Firestore transaction that calls `transaction.create()` on the
`gamerTags/{gamerTagLower}` reservation, creates `users/{uid}` and creates
`publicProfiles/{uid}` with zeroed statistics. Any failure deletes the Auth user. The
transaction's `create()` makes concurrent claims for the same lowercase tag safe: one
succeeds, the other fails and rolls back its Auth user. Registration never sets a custom
claim. Gamer tags are 3–16 characters, start and end alphanumerically, use only letters,
digits, `.`, `_` and `-`, disallow repeated specials and reject reserved platform words.
Tags are immutable; `PATCH /api/profile` rejects the field.

**Consequences.** The tag race is enforced by Firestore rather than a best-effort pre-check.
A failed registration leaves no orphan account. Name changes require a future, audited admin
process rather than a profile edit. Reserved words live in
`src/lib/config/reserved-gamer-tags.ts` for review.

---

## ADR-027 — Avatar bytes are uploaded, verified and rewritten by the server

**Date:** 2026-11-08
**Status:** Accepted

**Context.** ADR-025 chose Cloudinary but left upload unspecified. Accepting a client-built
URL would let a user point a profile at arbitrary content. Accepting a client-declared MIME
type would allow disguised files.

**Decision.** The browser crops to a centred square, resizes to 512×512 and compresses before
sending multipart bytes. The server ignores the declared MIME type, verifies JPEG/PNG/WebP
magic bytes, enforces a 1,000,000-byte cap, uploads to `gcc/avatars/{uid}` with server-only
Cloudinary credentials, builds the `f_auto,q_auto` delivery URL and writes it to both
profile documents in a transaction. Removing an avatar clears both documents and destroys the
previous asset. The client never sends or chooses a URL.

**Consequences.** Cloudinary configuration is optional at environment validation so auth and
profiles work before avatar storage is configured; the avatar route returns 503 until it is.
The browser still does the expensive resize work, but the server is the authority on format
and size. Rate limiting (5 changes per hour) limits storage abuse.

---

## ADR-028 — Unverified accounts may view their own profile

**Date:** 2026-11-08
**Status:** Superseded by ADR-046

**Context.** Requiring verification for every dashboard route would lock a new player out of
the profile they just created and make the verification panel hard to reach.

**Decision.** The participant dashboard layout uses `requirePageSignedIn`, which verifies the
session but not the email. Dashboard and profile pages render with a verification banner.
Server-side tournament registration and organiser/admin routes still use
`requireVerifiedUser`/role guards. Sign-in redirects unverified users to `/verify-email`
unless a safe `next` path was requested.

**Consequences.** A player can inspect and edit their profile immediately, while anything
competitive or privileged still requires a verified email. The banner keeps the state
visible instead of silently blocking actions.

---

## ADR-029 — Country options derive names and flags at runtime

**Date:** 2026-11-08
**Status:** Accepted

**Context.** Registration and profile editing need a country picker. Shipping a full
country-name package or hardcoding flag images adds weight and maintenance for a list that
browsers already understand.

**Decision.** Store the ISO 3166-1 alpha-2 code list in
`src/lib/config/countries.ts`. Build display names with `Intl.DisplayNames(["en"], { type:
"region" })` and flags from regional-indicator symbols. Default the selector to `KE` (the
launch community) but accept any valid code. The server validates the two-letter shape and
stores the uppercase code.

**Consequences.** The picker is localised by the browser without a runtime package. The
default is a product choice, not a restriction. Country names and flags are presentation
only; the stored value is the stable ISO code.

---

## ADR-030 — Platform settings live in one Super-Admin-only document

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Maintenance mode, registration availability and organiser limits must be
changed at runtime without a deploy. Exposing the whole settings document to the browser
would reveal operational policy and make client reads a trust boundary.

**Decision.** Store configuration in `platformSettings/main`, readable only by the Super
Admin through Security Rules. Server code reads it with the Admin SDK. Public pages receive
only `maintenanceMode`, `maintenanceMessage` and `registrationsOpen` through
`src/lib/platform/settings.ts`; the other fields never leave the server. A missing document
or read failure falls back to the documented defaults.

**Consequences.** There is one settings document and one validation schema. Reading settings
is a server concern, so pages that render the banner are dynamic. Changing the settings
document shape means updating the defaults, schema, public helper and rules tests together.

---

## ADR-031 — One shared maintenance gate for every write

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Checking maintenance mode in each route invites drift: one route forgets the
check and becomes a write path during an outage.

**Decision.** `assertPlatformWritable(user)` is the single gate. It returns 503 with the
configured message when maintenance is on, except for the Super Admin. Registration adds
`assertRegistrationsOpen()`. Every non-Super-Admin mutation calls the gate before writing,
and every Super Admin mutation calls it through `guardSuperAdminMutation()` after
authentication and rate limiting.

**Consequences.** The gate is unit-tested against defaults, custom messages and the Super
Admin exemption. A future write route that omits it is a review failure. The Super Admin can
always turn maintenance off because the gate exempts them.

---

## ADR-032 — Super Admin mutations share one guard sequence

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Phase 5 adds many privileged endpoints. Individually ordered checks are easy to
get wrong, especially origin checks before reading a body and the maintenance exemption.

**Decision.** Every `/api/super-admin/*` mutation calls `guardSuperAdminMutation()`:
same-origin → `requireSuperAdmin()` → rate limit → `assertPlatformWritable(user)`. Each route
then parses a strict Zod schema and writes with the Admin SDK. Account actions cannot target
the actor or another Super Admin.

**Consequences.** Origin checks always run before a body is read. Authorisation is always
server-side, and UI hiding is cosmetic. Integration tests call every route as a participant
(403) and without a session (401), so a new route without the guard fails the suite.

---

## ADR-033 — Announcements are soft-deleted and publicly filtered

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Platform notices must be visible to everyone while published, hidden while
drafted, and retained after removal for accountability. Allowing public reads of the whole
collection would leak drafts and deleted notices.

**Decision.** `announcements/{id}` stores title, body, severity, pinned, `publishedAt`,
optional `expiresAt`, author, timestamps and `deletedAt`. Rules allow public reads only when
`publishedAt` is set and in the past, `deletedAt` is null and `expiresAt` is null or future.
Create, edit, publish, unpublish and delete are separate server routes, all audited. Delete
sets `deletedAt` and clears `publishedAt`.

**Consequences.** The console reads drafts and deleted notices with the Admin SDK. The public
page and banner are server-rendered and cursor-paginated. Expiry is filtered in the query
layer and by rules. There is no hard-delete path.

---

## ADR-034 — Analytics are computed in-house from Firestore aggregates and a bounded sample

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Adding a chart library increases bundle size and often assumes fake demo data.
The Spark plan has no Cloud Functions, and no unbounded collection reads are permitted.

**Decision.** Build accessible SVG charts in `src/components/super-admin/charts.tsx` with no
chart dependency. Totals use Firestore `count()` aggregations. Breakdowns (country, game,
platform, daily signups) sample at most 1000 user documents; the sample size is stored and
shown. Results are cached in `platformStats/summary` for five minutes with a manual Refresh
action. Empty states are honest when there are no tournaments or matches yet.

**Consequences.** Most figures are exact, while breakdowns are labelled as sampled. Refresh
costs a bounded number of reads. A future scale-up can replace sampling with maintained
aggregates without changing the page contracts.

---

## ADR-035 — A per-applicant state marker makes application rules race-safe

**Date:** 2026-11-09
**Status:** Accepted

**Context.** "One pending application per user" and "wait out the rejection
cooldown" can be enforced two ways: scan the application history, or keep a
small marker. Scanning invites read-then-write races — two concurrent
submissions both see "no pending application" and both succeed.

**Decision.** Store `applicationState/{uid}` with `status`, `currentApplicationId`,
`lastApplicationAt`, `lastRejectedAt` and `lastApprovedAt`. Submission and every
review transition read and write the marker inside the same Firestore
transaction as the application document, so the one-pending and cooldown rules
are atomic. `lastRejectedAt` feeds the pure `applicationCooldown()` helper with
`applicationCooldownDays` from platform settings. The collection is
server-only: rules deny every client read and write.

**Consequences.** One extra document per applicant, updated transactionally. The
dashboard status page reads one marker plus one query instead of scanning
history. The application history itself stays append-only and is never used for
enforcement, only for review context.

---

## ADR-036 — Approval is the only organiser-granting path, with claim rollback

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Approving an application must grant the `organiser` custom claim and
flip the application status. Firestore cannot write Auth claims, so the two
writes cannot be one atomic operation; a failure between them could leave an
approved application with no claim, or a queue that lies about a review that
happened.

**Decision.** Approval pre-validates the applicant (Auth exists, enabled and
account not suspended/banned — email verification is not a criterion since
ADR-046), then commits `approved` plus reviewer
fields in a transaction that re-checks the status is `pending`. Only after the
transaction does it call `setUserRole(uid, "organiser")`, which revokes the
target's refresh tokens. If the claim write fails, a compensating transaction
restores the application to `pending` (clearing reviewer fields) and resets the
state marker, and the route returns 500. A repeated approval of an
already-approved application is a no-op success (idempotent); anything that is
not `pending` returns 409. The `organiser` role has no other granting route
besides the configured email + uid rule for `super_admin` (ADR-047).

**Consequences.** The applicant's old session is revoked by design; the login page
explains the redirect with a fixed `?reason=permissions` notice. A failed claim
leaves the application honestly pending for re-review. Integration tests cover
idempotency, the 409 paths, the rollback and the organiser-route lockout for
rejected applicants.

---

## ADR-037 — In-app notifications are server-written, owner-read and counted

**Date:** 2026-11-09
**Status:** Accepted

**Context.** Phase 6 needs real notifications (application transitions) without
building Phase 16's email system. The header bell must not add a per-page
read of a whole subcollection.

**Decision.** `createNotification(uid, {type, title, body, link})` writes
`users/{uid}/notifications/{id}`; `createNotifications` batches many recipients
in chunks of 500 (Firestore's batch limit). Types come from a closed union
(`system`, `tournament`, `fixture`, `result`, `result_report`,
`announcement`, `application`). Content is trimmed and capped (title 120, body 1000) and `link` is normalised by `safeRedirectPath()`. The bell runs two
queries per request for signed-in users only — the five newest plus a `count()`
aggregation of unread — memoised within a render with React `cache()`.
`POST /api/notifications/read` marks up to 50 named ids or all unread items,
resolved strictly under the session owner's path.

**Consequences.** No client write path exists; rules keep notifications
owner-read only. Unread counts are exact and cheap. Email delivery, digesting
and preferences stay in Phase 16.

---

## ADR-038 — Revoked-session redirects use a fixed `reason=permissions` flag

**Date:** 2026-11-09
**Status:** Accepted

**Context.** After an approval or role change the old session cookie is revoked.
The user lands on `/login` with no explanation, and the obvious fix — echoing a
message through the URL — would let anyone craft the login page's notice text.

**Decision.** Page access helpers detect "cookie present but session no longer
validates" and redirect to `/login?next=…&reason=permissions`. The login page maps
that fixed flag to a constant "Your permissions changed, please sign in again"
notice. The `next` parameter is still sanitised with `safeRedirectPath()`, and
the notice text is never taken from the URL.

**Consequences.** Approval and role changes get a friendly explanation without
an injectable message channel. Any future redirect reason must be added to the
fixed mapping, never passed through as raw query text.

---

## ADR-039 - `cancelled` is a public terminal status that keeps its records

**Date:** 2026-11-10
**Status:** Accepted

**Context.** Organisers need a way to stop a competition that will never be
played. Deleting the document would break registrations, membership snapshots
and audit history; hiding it would strand entrants who already registered.

**Decision.** `cancelled` is a first-class status in `TOURNAMENT_STATUSES`. Any
non-terminal stage may transition to it, and `cancelled` itself has no outgoing
transitions in `canTransition` (like `completed` and `archived`, it is
terminal). Security Rules list it in `isPublicTournamentStatus`, so a cancelled
competition and its registrations stay publicly readable; it is excluded from
`isPublishedTournamentStatus`, so matches/standings stay hidden. The workspace
stepper treats it as `setup done, everything else locked`, and the
Registrations tab stays available because entrants keep their records.

**Consequences.** A cancelled competition remains on public listing and organiser
pages with an honest "cancelled" badge, never resumes, and occupies no active
tournament slot. Rules tests cover public visibility of both the document and
its registrations.

---

## ADR-040 - `organiserProfiles` is server-written, publicly readable, honestly prefilled

**Date:** 2026-11-10
**Status:** Accepted

**Context.** Tournament pages need an "Organised by" attribution and each
organiser needs a public page, but no organiser has typed an organisation name
yet. Inventing a name or blocking the page until one exists were both worse
than an honest bootstrap.

**Decision.** One document per organiser at `organiserProfiles/{uid}`, written
only by `src/lib/organiser/profile.ts` through the Admin SDK and editable only
via `PATCH /api/organiser/profile` behind the strict Zod schema, same-origin
check, rate limit, maintenance gate and an `organiser_profile.updated` audit
entry. Rules grant public read and deny every write. `ensureOrganiserProfile`
creates the document idempotently, prefilling `organisationName` from the
latest approved application's `communityName`, falling back to the public
`gamerTag`; if neither exists it returns null and the settings page collects
the name on first save. Application approval calls it best-effort so approval
never fails from profile creation.

**Consequences.** Attribution and `/organisers/{uid}` show real data from day
one without fabrication. Logos can only be uploaded once the profile exists,
so a public page never renders an unnamed organisation. The uid, logo
references and timestamps are never accepted from a request body.

---

## ADR-041 - The tournament workspace renders 404, not 403, for non-owners

**Date:** 2026-11-10
**Status:** Accepted

**Context.** The organiser workspace URL pattern is guessable
(`/organiser/tournaments/{id}`). A 403 for another organiser's competition
would confirm that the competition exists - enumeration across organisers.

**Decision.** `requireTournamentOwnerOrSuperAdmin(id)` throws
`AuthorizationError` for a signed-in non-owner and `NotFoundError` for a
missing id, but the workspace layout catches both and calls `notFound()`. A
non-owner sees the branded 404 page identical to the one for a non-existent
tournament. The Super Admin is exempt because the console already lists every
tournament.

**Consequences.** One organiser cannot discover another organiser's competition
ids through the workspace. The distinction remains only inside the guard for
callers with a legitimate relationship (API routes still answer 403/404
precisely for the owner and Super Admin). Integration tests pin both guard
outcomes and the layout maps them to the single 404.

---

## ADR-042 - The public organiser page pages forward only

**Date:** 2026-11-10
**Status:** Accepted

**Context.** Authenticated lists paginate with bidirectional Firestore cursors,
which need stable `startAt` snapshots. Public pages are cached and share
cursors between visitors, so a "back" cursor captured by one visitor can be
replayed by another once documents shift.

**Decision.** `getPublicTournamentsByOwner(uid, after)` exposes only a forward
cursor: page size 9, ordered by `startsAt` desc then id, with `?after={id}`
as an opaque "Show older" link. Going back is a plain link to page one
("Back to latest competitions"). An unknown cursor yields an honest empty
page rather than an error.

**Consequences.** Public pagination is trivially cacheable and cannot leak a
stale snapshot; visitors cannot construct arbitrary cursors. Navigating to an
older page then back costs one reload of page one, which is acceptable for a
public archive.

---

## ADR-043 - An active tournament slot runs from registration open to knockout

**Date:** 2026-11-10
**Status:** Accepted

**Context.** `maxActiveTournamentsPerOrganiser` needs one honest definition of
"active" for the dashboard slot counter and the future creation guard
(Phase 8). Counting every owned document would punish archival; counting only
registration-open would let a league-phase competition evade the limit.

**Decision.** A competition occupies a slot while its status is
`registration_open`, `registration_closed`, `pots_confirmed`,
`fixtures_published`, `league_phase` or `knockout` - i.e. published and
running. `draft`, `suspended`, `completed`, `archived` and `cancelled` do not.
The Super Admin is exempt from the limit and the dashboard says so.

**Consequences.** The dashboard's "Active tournament slots: X of N" and the
Phase 8 creation guard agree by construction. Suspension frees the slot while
the competition is hidden, which matches the intent of the limit (concurrent
live operations), and the disabled create CTA explains the blocked state
without a server write.

---

## ADR-044 - Cancelled tournaments are not publicly readable

**Date:** 2026-11-11
**Status:** Accepted
**Supersedes:** the `cancelled` visibility rule in ADR-039.

**Context.** Phase 7 added `cancelled` as a terminal status and treated it as a
public tournament status. Phase 8 makes cancellation a real organiser and Super
Admin action, so the visibility rule now determines whether a cancelled
competition remains in public discovery lists, collection-group registration
reads and crawler indexes.

**Decision.** `cancelled` is removed from the public status allow-lists in
`firestore.rules`. A cancelled tournament stays readable only to its owner and
the Super Admin. Public tournament routes and lists stop showing it; a visitor
who follows an old direct link to `/tournaments/[slug]` sees an honest notice
page rendered by the server (which is authorised) rather than a 404 or a public
document read. The registration subcollection follows the same rule, so
collection-group registration queries cannot include a cancelled competition.

**Consequences.** Cancelled records are preserved for audit and history but are
no longer discoverable, which matches the meaning of cancellation. Organisers
and the Super Admin retain full access. Public pages that previously expected
cancelled entries (organiser public page, discovery) must filter or rely on the
rules; the Phase 8 tests assert that a cancelled cup never appears in either
place. ADR-039's status model otherwise stands.

---

## ADR-045 - Password policy is length only: 6-128 characters

**Date:** 2026-11-11
**Status:** Accepted
**Supersedes:** ADR-012.

**Context.** ADR-012 required ten characters. That is stricter than the platform
can enforce at the identity provider: Firebase Authentication's minimum password
length is six characters and cannot be lowered, while a stricter application-only
rule would lock out accounts created elsewhere and add friction for no verified
security gain. Players commonly enter simple passwords on mobile anyway, and a
blocked submission teaches them nothing.

**Decision.** One shared Zod `passwordSchema` governs registration and any future
password-setting form: minimum 6, maximum 128, **no complexity rules**, and no
trimming (spaces and emoji are valid characters). Sign-in uses a separate schema
that only requires a non-empty password up to 128 characters, so existing accounts
always remain able to sign in. The strength indicator is advisory only: it labels
Weak / Okay / Strong and never blocks submission. A weak password shows one gentle
amber message: "This password is easy to guess. You can still use it, but a longer
one is safer." Both the registration form and the server use the same schema; the
helper text is "At least 6 characters".

**Consequences.** The client and server agree by construction, and the boundary is
exactly the provider's floor. Weak passwords are accepted, which is a deliberate
trade-off: mitigation comes from rate limiting, mandatory unique gamer tags and a
WhatsApp contact number rather than from composition theatre. The unit tests pin
the policy (5 rejected, 6 and 128 accepted, 129 rejected, `abcdef`, `123456`,
spaces and emoji accepted). Any future password-change screen must import the same
schema.

---

## ADR-046 - Email verification is removed from the product

**Date:** 2026-11-11
**Status:** Accepted

**Context.** Email verification added a mandatory detour between registration and
the first meaningful action. It failed often in practice: players mistyped an
address, the hosted action handler landed them on a page that could not complete a
session exchange, and a mistyped address was unrecoverable without support. The
platform had no way to require a mobile number during that phase, and the extra
step was costing registrations without proving that an address was deliverable.

**Decision.** The product no longer verifies email addresses. `/verify-email`, the
verification panel, the dashboard banner, the resend and "I've verified" controls,
every `sendEmailVerification` call, the `requireVerifiedUser` guard, page-level
verified gates, verified badges on Super Admin screens and the `email_verified`
rule are removed. Registration signs the new account in and sends it straight to
`/dashboard`. The password-reset flow remains and is the supported recovery path.
The registration form adds a **Confirm email** field: the client compares the two
values and the server still trims and lowercases the address it stores.

**Consequences and trade-offs.** Fake or mistyped addresses are now possible and
are not blocked. The platform mitigates that with the Confirm email field, the
registration and session rate limits, unique gamer tags (one account per tag) and
the mandatory WhatsApp number used for competition contact. A fake address costs
the player their own account recovery, not another user's safety. Accounts that
were already verified keep working; the flag is simply no longer consulted. The
Super Admin application review no longer refuses an applicant for an unverified
address and only checks that the account exists and is active.

---

## ADR-047 - The Super Admin is pinned by email AND uid

**Date:** 2026-11-11
**Status:** Accepted

**Context.** Before this change, `SUPER_ADMIN_EMAIL` alone granted `super_admin`,
guarded by an email-verified check. With verification removed (ADR-046), the email
address became the only identifier, so anyone who created an account with the
owner's address before the owner did could hold the identity. Email alone is not a
secret and is not stable proof of who controls an account.

**Decision.** A server-only, optional `SUPER_ADMIN_UID` joins `SUPER_ADMIN_EMAIL`.
`super_admin` is granted only when the account's `uid` **and** its normalized,
case-insensitive email both match the configured pair. The uid is read from
`getServerEnv()`, never hardcoded and never sent to the browser. When
`SUPER_ADMIN_UID` is missing or blank, the role is withheld from **everyone** (fail
closed) and the server logs one clear error with the exact instructions for finding
the uid (Firebase Console → Authentication → Users). The check lives in one pure
function, `isSuperAdminAccount`, used by role assignment, session exchange and
`requireSuperAdmin`. Stale privileged claims are still stripped and refresh tokens
revoked when an account stops matching.

**Consequences.** Squatting `SUPER_ADMIN_EMAIL` with a different uid can never
elevate an account; an emulator test registers that email under a different uid and
asserts the session role stays `user`. Rotating the Super Admin requires changing
both values and redeploying, which is intentionally a deployment action rather than
a console action. The console can never demote or reassign the pinned account. The
unit and integration tests cover the match, both mismatch directions, the missing
UID case and the irrelevance of the old verified flag.

---

## ADR-048 - The draw is seeded server-side and replayable

**Date:** 2026-11-12
**Status:** Accepted

**Context.** A pot draw is a fairness decision. A client-side shuffle or a
client-supplied seed could be reproduced, steered or disputed. Players need a way to
trust that the allocation was not edited after the fact.

**Decision.** The shuffle runs only on the server. A fresh 32-byte seed is generated
with `crypto.randomBytes` and stored as `shuffleSeed` alongside `algorithmVersion`.
The allocation itself is produced by the pure engine: cyrb128 hashes the seed string
and expands it into a mulberry32 stream, `nextInt` uses rejection sampling for
uniformity and `shuffle` is Fisher-Yates. Every seed and algorithm version is
recorded in the audit log. The engine may not import Firebase, Next.js, React or
`process.env`, and may never call `Math.random`; an ESLint rule and a purity test
enforce both.

Pins are stored as `locks` and survive a re-shuffle. The organiser can still move a
player by hand (`method: "mixed"`), and every move is audited.

**Consequences.** A completed shuffle can be replayed from the stored seed and
algorithm version. Changing the algorithm in a replay-breaking way requires a new
`algorithmVersion`. The seed is public after confirmation, which reveals nothing
useful because the result is already public and the draw is no longer editable. A
manual draw records `method: "manual"` and relies on the audit log rather than a
seed, which is honest rather than pretending a manual draw was random.

---

## ADR-049 - The draw opens only for a closed, exactly full field

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The launch format is fixed at 36 participants in four pots of nine.
Allowing a draw while registration is open or the field is short creates a draw that
cannot be confirmed and can change underneath the organiser.

**Decision.** `getPotsAvailability` and the pots page unlock only when the tournament
status is `registration_closed` **and** exactly 36 players are registered. Every
other case shows the exact reason (for example, “this competition has 31”). The
check belongs to the shared workspace model, so the lifecycle stepper and the page
agree. Confirmation re-reads the registered field and the stored pots inside one
transaction and validates four pots of nine against the live registrations; a
concurrent double-confirm leaves exactly one winner and one audit entry.

**Consequences.** A short field is visibly stuck at the pots stage with an actionable
message instead of an unusable board. The client may not send counts, pots or seeds;
the server derives all three. A closed registration can still be re-opened by the
normal lifecycle rules if the organiser needs to fill the field.

---

## ADR-050 - A confirmed draw is read-only, with one guarded escape hatch

**Date:** 2026-11-12
**Status:** Accepted

**Context.** After confirmation the draw becomes public and is the input to fixture
generation. Silent edits would invalidate published fixtures and destroy trust.
Real tournaments still need a correction path before fixtures exist.

**Decision.** A confirmed draw cannot be shuffled, moved, pinned or cleared.
`unconfirm` returns it to draft and the tournament to `registration_closed` only
while no fixture draft and no match exist, requires a 5–300 character reason, and is
audited. `replace` swaps one outgoing registered player for one incoming player in
the same pot slot, keeps the field at exactly 36, applies the Phase 8 platform and
country rules, and is likewise blocked once fixture work exists. Both actions notify
the affected players. The public Pots tab renders only a confirmed draw; a draft is
invisible even on a public tournament.

**Consequences.** Fixtures can be generated against a stable, public draw. Corrections
are deliberate and traceable. Once fixture work starts, the only path is to remove
that work first; the platform never rewrites a draw under published fixtures. The
transparency panel shows the method and seed so players can see whether the draw was
seeded, manual or mixed.

---

## ADR-051 - Fixtures are built in three deterministic steps

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The launch format needs 144 matches where every one of 36 players has
eight matches, faces two opponents from each pot (including their own pot), has one
home and one away match against each pot, plays exactly once per matchday and never
faces the same opponent twice. Solving all of that with a single general-purpose
constraint search would be slow and hard to explain.

**Decision.** `src/lib/engine/fixtures/` builds the schedule constructively. Step A
turns each pot into a seeded ring (one home and one away within the pot) and joins
each pot pair with a seeded bijection that contributes two matches per position, one
oriented each way. The result is an 8-regular graph with balanced home/away edges.
Step B assigns the eight matchdays as a proper 8-edge-colouring using an Algorithm X
/ Dancing Links exact cover with a 50,000-node budget. If the budget is exhausted, the
whole build retries from `deriveSeed(seed, "attempt-k")`, up to 50 attempts, and then
throws `FixtureGenerationError("attempts-exhausted")`. Step C is a 240-iteration
seeded walk that may flip a whole block's orientation or permute matchday labels; it
never changes a pairing, so pot quotas and the 4/4 split survive by construction.

**Consequences.** The constructive proof is short enough to test directly: ring
adjacency gives two pot-mates, the bijection gives two opponents per other pot with
one home and one away, and every colour class covers all 36 players. Because Step C
can move a match between matchdays, the validator must still be the authority; it is
run on every generated draft. Step B is deterministic but bounded, so a pathological
seed fails loudly rather than degrading into an invalid schedule. The attempt seed and
node count are stored in the draft and audit log.

---

## ADR-052 - The fixture validator is independent and the canonical hash gates publication

**Date:** 2026-11-12
**Status:** Accepted

**Context.** A validator that reuses the generator's internal helpers can share the
same bug and approve a schedule the rules do not actually allow. A draft can also be
edited between generation and publication, including display tags that should not
change the fixture identity.

**Decision.** `validate.ts` imports nothing from the generator or the colouring
module. It re-derives pots, pair uniqueness, matchday coverage, per-player counts and
per-pot home/away totals from the input and returns typed codes. The server runs it
after every generation and again inside the publication transaction. The canonical
hash sorts fixtures by matchday, home id and away id, then SHA-256s newline-terminated
`matchday\0homeId\0awayId` lines using ids only. Publication stores that hash on the
draft and on the tournament; verification recomputes it from the stored matches and
compares it with both. A hash mismatch is an integrity failure even when the
structural validator happens to pass.

**Consequences.** Generation cannot approve itself, and a direct Firestore edit to a
match is detectable after the fact. Display-tag corrections do not invalidate the
hash. The cost is one extra validation and hash pass at publish, both well under a
second for 144 rows. The verifier never edits anything and never reports success from
a missing tournament hash.

---

## ADR-053 - Fixture drafts are private and publication is one transaction

**Date:** 2026-11-12
**Status:** Accepted

**Context.** A fixture draft is transitional and may be regenerated several times.
Showing it publicly would confuse players and expose a schedule that is not final.
Publication must not expose a half-written league phase.

**Decision.** `fixtureDrafts/current` is readable only by the owner and the Super
Admin. The public page, the public fixture loader and `/dashboard/fixtures` require a
published tournament status before reading matches. Publication runs in one Firestore
transaction that re-reads the tournament, draw, draft and existing match, re-runs the
validator and the hash, then writes exactly 144 matches (`league-md{NN}-m{NN}`), eight
matchday windows and 36 zeroed standings before updating the tournament to
`fixtures_published`. That is 189 writes, below the 500-write limit. A concurrent
second publish loses the tournament-document conflict and returns 409; the integration
test asserts exactly one set of 144/8/36 documents and one audit entry.

**Consequences.** There is no public draft leak and no partially published league.
Regeneration is allowed only while the tournament is still `pots_confirmed`. Reset is
the only way back, and it is refused once any match is completed or carries a result.
Player notifications run after the transaction in chunks of 18, so a notification
failure cannot roll back a valid publication.

---

## ADR-054 - Matchday windows are informational and editable

**Date:** 2026-11-12
**Status:** Accepted

**Context.** Organisers need to communicate when each matchday is expected to be
played, but those dates can move because of real-world scheduling. Storing the window
as part of the fixture identity would make an innocent date change look like schedule
tampering.

**Decision.** Publication accepts eight optional windows. When omitted, matchday 1
starts at the tournament's `startsAt`, each later matchday starts seven days after the
previous one, and each window lasts six days. The windows are stored as their own
`matchdays/{n}` documents and can be edited by the owner or Super Admin at any
published stage through `PATCH .../fixtures/matchdays/[n]`. The edit validates the
date order, audits the before/after values and never touches a match, a result or the
canonical schedule hash. Each match stores the window start as an informational
`scheduledAt`.

**Consequences.** Organisers can correct dates without regenerating or republishing
144 matches. The schedule hash stays stable because it deliberately excludes windows
and tags. Public and player views format the stored timestamps in the tournament time
zone.

---

## ADR-055 - Player fixtures use one collection-group query with a server visibility check

**Date:** 2026-11-12
**Status:** Accepted

**Context.** A player may compete in several tournaments, so `/dashboard/fixtures`
needs every match where the player is a participant without first knowing which
tournaments to read. Firestore Security Rules cannot prove a broad cross-tournament
query is safe, and the Admin SDK bypasses rules anyway.

**Decision.** `getPlayerFixtures` runs one `collectionGroup("matches")` query with
`participants array-contains uid` and `orderBy("matchday")`, limited to 200 rows. It
uses the existing composite collection-group index on `participants CONTAINS` +
`matchday ASC`. The server reads the referenced tournaments and drops any match whose
tournament is not in a published status (`fixtures_published`, `league_phase`,
`knockout`, `completed`, `archived`). Opponent names, avatars and countries come from
public profile documents; missing profiles fall back to the snapshot tags on the match.
The page returns an honest empty state when nothing is published.

**Consequences.** The dashboard costs one indexed collection-group query, one batched
set of tournament reads and one set of public-profile reads, regardless of how many
tournaments the player has entered. Visibility is enforced twice: the rules protect
client reads, and the data module enforces the same rule for Admin SDK reads. The
composite index must be deployed with `firebase deploy --only firestore:indexes`.

---

## ADR-056 - Results are an owner-only transaction, never a player submission

**Date:** 2026-11-12
**Status:** Accepted

**Context.** Phase 11 needs final scores for 144 league matches. Allowing players to
submit or confirm a score would add a pending-result state, disputes and a second
source of truth. The league also needs to know when the first real result exists.

**Decision.** Only the tournament owner or a Super Admin records a result. The
`/api/organiser/tournaments/[id]/results/enter`, `/bulk`, `/correct` and `/clear`
routes sit behind the same-origin, organiser role, rate-limit, platform-write and
Zod gates as every other organiser mutation. `src/lib/tournament/result-state.ts`
holds the pure transition rules and `src/lib/tournament/results.ts` applies them in
one Firestore transaction: it re-reads the tournament and each match, requires
`stage: "league"`, writes the result and `completed` status, increments or
decrements `leagueMatchesCompleted`, and moves the tournament between
`fixtures_published` and `league_phase`. A second entry finds a completed match and
returns 409 with a "use correct" hint. Concurrency is left to Firestore: the losing
transaction retries, sees the committed result and is rejected.

**Consequences.** There is exactly one writer and one result shape. Entry and the
counter can never disagree. Bulk entry accepts at most 18 rows and is
all-or-nothing. Audit entries and both player notifications run after the
transaction, so a notification failure never rolls a recorded result back. The
`onLeagueResultsChanged(tournamentId)` hook is called after every successful
mutation; Phase 12 replaces its no-op body with standings recalculation.

---

## ADR-057 - Corrections and clears require a reason and preserve history

**Date:** 2026-11-12
**Status:** Accepted

**Context.** A mistyped score must be fixable, but the league table and public
match page must never silently change. Deleting a result would erase the fact that
an admin had recorded one.

**Decision.** `correct` keeps `enteredBy` and `enteredAt`, sets `lastEditedBy` and
`lastEditedAt`, increments `editCount`, and requires a 5–300 character reason.
`clear` writes `result: null` and `status: "scheduled"`, requires a reason, and
decrements `leagueMatchesCompleted`. When the counter reaches zero the tournament
returns to `fixtures_published`. Both actions write an audit entry containing the
before and after scores, the reason and the actor. Both notify the two players.

**Consequences.** Public and organiser pages can show who entered and who last
corrected a result. The audit log is the permanent record. Clearing has no
separate "deleted result" document; the audit entry carries the previous score.

---

## ADR-058 - Result reports are participant-only messages with one open report per match

**Date:** 2026-11-12
**Status:** Accepted

**Context.** Players need a way to flag a wrong score without gaining any result
authority. The organiser needs a reviewable queue rather than a stream of
notifications.

**Decision.** A completed match's two participants may open a
`resultReports/{id}` document with a 10–500 character reason. The server re-checks
participation, the completed status and the tournament's published state, then
rejects a second `open` report from the same player for the same match. Creation
notifies the organiser. The organiser inbox and the Super Admin cross-tournament
collection-group inbox both support status filters and cursor pagination. Resolve
and dismiss require a 5–300 character admin note, audit the decision and notify
the reporter. A report never edits the result; the match link opens the results
correction panel, which has its own reason and audit entry.

**Consequences.** The report channel cannot become a shadow result workflow. The
one-open rule keeps the queue honest while still allowing a fresh report after a
correction. Report documents duplicate `tournamentId` so the Super Admin
collection-group query can resolve the parent tournament.

---

## ADR-059 - The public results tab is derived from published matches

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The public tournament page already loads every published fixture.
A separate results collection would duplicate data and could drift.

**Decision.** The Results tab is a read-only projection of the same
`getPublicFixtures` rows: only `status: "completed"` matches with two scores,
grouped by matchday with the newest matchday first, and linked to a shareable
`/tournaments/[slug]/matches/[matchId]` page. The match loader re-checks that the
tournament is in a published fixture status before returning anything, and uses
public-profile display data only. Fixture cards link to the same match page.

**Consequences.** No extra query or collection is needed and a score cannot appear
in one public surface without appearing in the other. An unplayed fixture shows
"vs", never a placeholder score. The match page has its own metadata for sharing.

---

## ADR-060 - Match history is a completed-only collection-group page

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The profile page needs a real career history without scanning every
tournament a player has entered. Match document ids repeat across tournaments
(`league-md01-m01`), so a bare document-id cursor is ambiguous.

**Decision.** `getPlayerMatchHistory` queries the `matches` collection group with
`participants array-contains uid`, `status == "completed"` and
`orderBy("updatedAt", "desc")`, ten rows per page. Cursors are opaque
`${tournamentId}/${matchId}` strings resolved back to a document snapshot before
`startAfter` or `endBefore`. The loader re-checks the parent tournament's public
fixture status in code and drops hidden rows. Outcome is derived from the player's
own side. The profile statistics numbers stay unchanged; history is a separate
list.

**Consequences.** The page uses one composite index
(`participants CONTAINS + status ASC + updatedAt DESC`) and one public-profile read
per opponent. Cursor pagination remains stable while new results arrive. The
index must be deployed with `firebase deploy --only firestore:indexes`.

---

## ADR-061 - League standings are derived inside every result transaction

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The league table must never disagree with the recorded results, and it
must be impossible for an organiser to edit a position, a point or a tie-break by
hand. A separate "recalculate standings" job after each result would create a window
where the match says one thing and the table says another.

**Decision.** `src/lib/tournament/results.ts` rebuilds the complete table inside the
same Firestore transaction as every enter, bulk, correct and clear. Firestore requires
reads before writes, so the transaction reads the tournament, the current draw, all
registrations and all matches first, applies the pending result change in memory, then
writes the match, all 36 `standings/{uid}` documents and the tournament counters.
A bulk batch computes once and writes once. Publication of fixtures writes the same
36 zero-match rows from the confirmed draw so the Table tab exists before the first
result. The pure engine in `src/lib/engine/standings/` performs the calculation; the
server module only supplies identities and the deterministic lot seed.

**Consequences.** A committed result and its table are atomic: a failed transaction
leaves the previous table exactly as it was. No route accepts a table value, so manual
standings edits are structurally impossible. The transaction reads at most 144 match
documents and writes 36 standing documents plus counters, well under the 500-write
limit. `standingsUpdatedAt` and `leagueMatchesCompleted` move with the table.

---

## ADR-062 - Tie-breakers are one sequential comparator with a deterministic lot

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The launch format needs a documented, reproducible order. Head-to-head
mini-leagues are hard to explain and can produce cycles. A final alphabetical or
manual fallback would silently rewrite the table whenever two records are equal.

**Decision.** The `uefa` profile (default) sorts the whole table once by points, goal
difference, goals scored, away goals, wins, away wins, opponents' aggregate points,
opponents' aggregate goal difference, opponents' aggregate goals, then the lot. The
`classic` profile uses points, goal difference, goals scored, wins, then the lot. Higher
values rank first; the lot ranks ascending. `deriveLot(tiebreakSeed, uid)` hashes the
draw's stored tie-break seed and the player id into a safe 53-bit integer, so the same
tournament always produces the same order. A participant-id comparison is the final
strict-order safety net.

**Consequences.** Input array order can never change the table; the 1,000-run property
test shuffles players and matches and compares the serialised rows. Every row exposes
`separatedBy`, the first criterion that split it from the row above when points are
level, so the UI can explain a tie instead of showing an unexplained order. No manual
ordering exists anywhere in the product.

---

## ADR-063 - The tie-break profile locks after the first league result

**Date:** 2026-11-12
**Status:** Accepted

**Context.** The profile is part of the published table's meaning. Changing it after
results have been recorded would retroactively reorder matches that spectators already
saw.

**Decision.** `tiebreakerProfile` is accepted by the tournament PATCH schema and is
editable while `leagueMatchesCompleted` is zero, including after fixtures are
published. Once a result exists the editable-fields matrix removes it; the PATCH
transaction re-reads the fresh tournament and returns 403 with a field error if a
client still sends it. The organiser Settings select explains both profiles and shows
the lock reason. The change is audited like every other tournament update.

**Consequences.** A competition can choose its rules until the first ball is played and
cannot rewrite them afterwards. Repairing a table never changes the profile; the
recalculate action rebuilds with the stored profile. Super Admins are bound by the same
lock because the rule lives inside the transaction, not in the UI.

---

## ADR-064 - Standings are server-rendered and repaired only by verify/recalculate

**Date:** 2026-11-12
**Status:** Accepted

**Context.** Spectators and players need a live table, while the organiser needs a way
to prove that a stored table matches the recorded results and to recover from a manual
corruption or a bug without inventing values.

**Decision.** `GET /api/organiser/tournaments/[id]/standings/verify` recomputes the
table and compares every stored field, reporting missing rows, unexpected rows and
field-level mismatches without writing. `POST .../standings/recalculate` rebuilds all
rows inside one transaction and writes an audit entry. Both require the owner or Super
Admin; another organiser gets 404 and a plain player 403. The public Table tab is a
server-rendered projection of the stored rows with a 30-second revalidation window; the
organiser Standings tab shows the same table plus the active profile and the two
integrity actions. Player dashboards and profiles read only their own row for an active
tournament and show an honest empty state when no table exists. `provisional` is derived
from `leagueMatchesCompleted < 144`, never guessed.

**Consequences.** There is one read model for every surface and no client-side table
computation. Verification is read-only, so it cannot mask a bug. Repair is explicit and
audited, and it cannot accept a score or a position. A table appears at publication and
changes only when a real result changes.

---

## ADR-065 - Knockout bracket is independently defined and server-drawn

**Date:** 2026-11-13
**Status:** Accepted

**Context.** Phase 13 adds the knockout stages after the 36-team league phase. The
bracket must be reproducible, auditable and fair, and it must reuse the existing
competition engine and server patterns. It must not pretend to be an exact copy of
UEFA's path, and results stay owner/Super-Admin entered.

**Decision.** The bracket is defined by GCC in `src/lib/engine/knockout/` and documented
in `docs/03-COMPETITION-ENGINE.md`. Positions 1-8 go straight to the Round of 16;
9-16 are seeded and 17-24 unseeded in four fixed play-off groups (A: 9-10 v 23-24,
B: 11-12 v 21-22, C: 13-14 v 19-20, D: 15-16 v 17-18). The eight play-off winners
complete the Round of 16 against direct qualifiers in the order `[1, 8, 4, 5, 2, 7, 3, 6]`,
so seeds 1 and 2 can only meet in the final. Quarter-finals and semi-finals pair adjacent
bracket slots, and the final is always one leg. Draws are pure functions of a
server-generated seed; the client never supplies a tie, seed or match id.

Generated rounds are stored as private `knockoutDrafts/{round}` documents and only become
public `knockoutTies/{tieId}` plus leg match documents on publish. Every draft is replayed
through an independent validator that re-derives counts, group pairing, direct-qualifier
placement and the bracket path. A round can be redrawn only before it is published, and
an unpublished draft can be reset while a published one is immutable.

**Consequences.**

- There is no away-goals rule. A tie level on aggregate after all legs is stored as
  `needs_decider`; the organiser records the winner, method (`extra_time` or `penalties`),
  an optional note and, for penalties, a consistent penalty score.
- Closing the league phase freezes the table: `provisional` becomes false for every row
  and knockout results never rebuild standings.
- Result entry and correction dispatch to `knockout-results.ts`, which recomputes the tie
  from its legs in one transaction and locks a round once the next round is published.
- `npm run simulate` runs the same end-to-end runner as the integration test against the
  emulators and prints the per-round summary, so the full path stays verifiable.
