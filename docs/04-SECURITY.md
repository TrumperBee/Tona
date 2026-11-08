# GCC — Security Requirements

> **Status: Phase 3B implemented.** Firestore rules, session exchange, guards,
> role/status administration, audit logging, rate limiting, same-origin checks,
> security headers and rules tests exist. CSP and App Check remain Phase 18.

## 1. Security model

**Clients read; the server writes.**

- Firestore Security Rules deny every client write, permanently. There is no
  exception for users, organisers or Super Admins.
- Every mutation runs in a Next.js route handler or server action using the
  Firebase Admin SDK after: authenticate → authorise → validate with Zod →
  write with server timestamps → audit important actions.
- The Admin SDK bypasses Security Rules. It is guarded by `server-only` and must
  never be imported into client code.
- Roles are Firebase custom claims (`role`): `user`, `organiser`, `super_admin`.
  Only server code sets claims. The client never sends a role.

## 2. Threat model and controls

### 2.1 Role escalation

**Threat:** a user submits `role=super_admin`, edits a Firestore document, calls
an admin route, or exploits a stale claim after the owner changes.

**Controls:**

- Client input never contains a trusted role. Guards read the verified session
  cookie's custom claim.
- `setUserRole` is callable only after `requireSuperAdmin()` and re-checks the
  actor's role as defence in depth.
- `assertRoleAssignmentAllowed` allows `super_admin` only for the configured,
  **verified** `SUPER_ADMIN_EMAIL`, case-insensitively. The function is pure and
  unit tested.
- The configured owner account cannot be demoted.
- The session exchange strips a stale `super_admin` claim and revokes refresh
  tokens when the email no longer matches or is unverified.
- `requireSuperAdmin()` also compares the verified email with the configured
  owner email, so a stale claim alone is insufficient.
- Role changes revoke the target's refresh tokens. The old claim remains only
  until the ID token expires, never beyond the revocation check.
- Security Rules check the `role` claim and a verified email.

### 2.2 Gamer-tag races

**Threat:** two users claim the same tag concurrently, or casing/whitespace
variants create duplicate identities.

**Controls (Phase 4 implementation):**

- `gamerTags/{gamerTagLower}` uses the normalised lowercase tag as the document
  id. Firestore guarantees one document per id.
- Profile creation/update runs in a transaction that reserves the tag and writes
  the profile together; a failed transaction leaves no partial reservation.
- The reservation collection is server-only on read and write.
- Zod normalises whitespace and validates the allowed character set.
- Changing a tag releases the old reservation and reserves the new one in the
  same transaction.

### 2.3 Phone-number leakage

**Threat:** WhatsApp numbers appear in public profiles, fixture snapshots,
registrations, announcements or client-readable collections.

**Controls:**

- `whatsappE164` exists only in `users/{uid}`, readable by the owner and Super
  Admin.
- `publicProfiles`, `registrations` and match display snapshots contain gamer
  tags and countries only, never phone numbers or emails.
- Opponent contact is exposed later through a server route that authorises the
  request and returns only the necessary link/number.
- Rules tests assert public documents are readable without exposing the private
  user document.

### 2.4 Result tampering

**Threat:** a player submits a final score, edits a recorded result, changes
standings, or claims a win without authorisation.

**Controls:**

- Results are entered strictly by the tournament owner or Super Admin. There is
  no player submission or confirmation stage and no `pendingResult`.
- Only server code writes results after authentication, ownership authorisation
  and Zod validation (0–99 integers and valid tournament/match ids). The server
  recalculates standings from completed results with the Admin SDK.
- Match documents and standings have no client write path.
- Corrections require a reason, increment `editCount`, and write before/after
  values to the audit log. History is retained.
- Match results and standings become publicly readable only when the tournament
  is published, never while a draft or suspended.

### 2.5 Result report abuse

**Threat:** unrelated users read or create reports, or a reporter changes an
official result through the report channel.

**Controls:**

- `tournaments/{id}/resultReports/{id}` is a player-to-admin channel only. It
  cannot change a result.
- Firestore rules allow reads only to the reporter, the tournament owner or the
  Super Admin. Writes remain deny-all.
- Creation and resolution are server-only, validated with Zod and audited.
- The server verifies that the reporter participated in the match before writing.
- Rate limiting is applied when the channel is implemented in Phase 11.

### 2.6 Token and session theft

**Threat:** an attacker steals a session cookie or ID token, or keeps using a
session after role/status changes or sign-out.

**Controls:**

- The session cookie is `httpOnly`, `Secure` in production, `SameSite=Lax`,
  path `/`, with a lifetime from `SESSION_COOKIE_MAX_AGE_DAYS` (default 5 days).
- Guards verify the cookie with `checkRevoked: true` on every protected request.
- Disabled Firebase Auth users are treated as signed out.
- Sign-out revokes refresh tokens and clears the cookie.
- Role and account-status changes revoke the target's refresh tokens.
- Account status (`suspended`, `banned`) disables the Firebase Auth user, revokes
  refresh tokens and is mirrored to `users/{uid}.status`; the session route
  rejects non-active accounts.
- The client never stores Admin credentials.
- Security headers are set in `next.config.ts`: `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options:
DENY` and a restrictive `Permissions-Policy`. A Content-Security-Policy is
  deferred to Phase 18 so it can allow Firebase and Cloudinary deliberately.
- State-changing routes call `assertSameOrigin()` before reading a body. A
  request without a matching Origin (or same-origin Referer fallback) is rejected
  with 403. This complements `SameSite=Lax`; every future POST/PATCH/PUT/DELETE
  route must use the helper.

### 2.7 Enumeration

**Threat:** attackers discover which emails, UIDs or accounts exist through
different error messages, public profiles or collection reads.

**Controls:**

- Session exchange returns one generic 401 for token/verification failures and
  does not reveal whether an account exists.
- Account-status rejections do not disclose role or admin-application details.
- Private collections (`users`, `gamerTags`, `adminApplications`, `auditLogs`,
  `rateLimits`, `platformStats`) have no broad public read.
- `publicProfiles` contains only intentionally public display data.
- Guards check authentication before loading records; not-found and forbidden
  responses are kept distinct only where the caller already has a legitimate
  relationship (for example tournament ownership).
- Rate limiting reduces brute-force account and session probing.

### 2.8 Other abuse

- **Draft leakage:** draft and suspended tournaments and all their subcollections
  are hidden by rules. Fixture drafts never become public. Collection-group
  reads for `matches` and `registrations` resolve the parent tournament from
  `tournamentId`; a query that does not constrain it fails instead of leaking a
  hidden tournament. Rules tests cover both allowed and blocked queries.
- **Audit tampering:** only the Admin SDK writes audit logs; Super Admin can read
  them, nobody can write or delete them from a client.
- **Gamer-tag enumeration:** `gamerTags` is server-only.
- **Owner lockout:** the configured Super Admin cannot be suspended, banned or
  demoted, and an actor cannot change their own status.
- **Rate-limit bypass:** counters use Firestore transactions, not per-instance
  memory. Limitations are documented in `src/lib/rate-limit/index.ts`.
- **No hard deletes:** rules deny deletes and the server uses status/archive
  changes. Competition records are retained.

## 3. Authentication and sessions

- Firebase Authentication owns password hashing and credential verification.
- `POST /api/auth/session` receives a Firebase ID token, verifies it, checks the
  Auth user and private account status, applies the Super Admin rule, creates an
  http-only session cookie and returns the role so the client can force a token
  refresh when claims changed. `DELETE /api/auth/session` clears the cookie and
  revokes refresh tokens. Both reject cross-origin requests.
- Email verification, password reset and email-change links use Firebase's
  default hosted email action handler. The application has no `/auth/callback`
  route and never handles Firebase action codes itself.
- `src/proxy.ts` only checks for cookie presence and redirects to `/login`. It is
  a navigation guard, not authorisation. The `next` parameter is sanitised by
  `safeRedirectPath()`; only a same-origin relative path is accepted.
- Server guards (`src/lib/auth/guards.ts`) are the authorisation boundary:
  `getCurrentUser`, `requireUser`, `requireVerifiedUser`, `requireRole`,
  `requireSuperAdmin`, `requireTournamentOwnerOrSuperAdmin`.
- `requireRole` uses the hierarchy user < organiser < super_admin.
- `requireTournamentOwnerOrSuperAdmin` loads `ownerUid` from Firestore; it never
  trusts a client-supplied owner.

## 4. Firestore Security Rules

- Default deny; no client writes anywhere.
- Tournament documents are readable by the public unless `draft` or `suspended`.
- Tournament subcollections are hidden for draft/suspended tournaments.
- Matches become public only for published statuses (`fixtures_published`,
  `league_phase`, `knockout`, `completed`, `archived`).
- Draws become public only after `confirmedAt` is set.
- Fixture drafts are owner/Super Admin only.
- Result reports are readable by the reporter, tournament owner or Super Admin.
- Collection-group queries for `matches` and `registrations` require the query
  to constrain `tournamentId`; the rules resolve the parent tournament and deny
  draft/suspended results.
- Audit logs and platform stats are Super Admin only.
- `gamerTags` and `rateLimits` have no client read.
- Rules are versioned in `firestore.rules`; indexes in
  `firestore.indexes.json`.
- Tests use `@firebase/rules-unit-testing` against the emulator. The emulator
  requires Java 21. Run `npm run test:rules`; plain `npm test` never needs Java.
  Tests cover anonymous denial, owner-only reads, draft isolation, organiser
  ownership, result-report access, collection-group leakage, Super Admin audit
  access and the deny-all write matrix for user, organiser and Super Admin
  clients.

## 5. Server-side role enforcement

- Every protected read and write verifies the session, role and ownership on the
  server.
- `Super Admin` means the configured email plus the `super_admin` role claim.
- `Organiser` may act only on tournaments they own; ownership is loaded from
  Firestore.
- Participant permissions are scoped to their own registrations, result reports,
  profile, memberships and notifications.
- Hiding a button is never an authorisation control.

## 6. Secrets management

- Only `NEXT_PUBLIC_*` variables reach the browser.
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY`, `SUPER_ADMIN_EMAIL` and
  `SESSION_COOKIE_MAX_AGE_DAYS` are server-only and validated by
  `src/lib/config/env.server.ts`.
- The private key keeps escaped `\n` sequences and is normalised only in server
  memory.
- `.env.local` is git-ignored; `.env.example` contains no real values.
- Secrets are never logged, returned in responses or embedded in client
  components.

## 7. Input validation

- Every server action and route handler parses input with a Zod schema.
- Payload schemas cover profiles, admin applications, tournament create/update,
  admin result entry/corrections, result reports, role changes and account
  status.
- Status, owner, counters, roles and computed standings are never accepted from
  clients.
- Firestore document shapes are enforced in server code because Firestore has no
  schema.
- URLs, slugs, phone numbers, country codes and gamer tags use allow-lists and
  normalisation.

## 8. Rate limiting

- Firestore-backed fixed-window counters run in transactions, so all serverless
  instances share the budget.
- Sensitive endpoints: session exchange (implemented), registration, password
  reset, admin result entry, result-report creation and admin application (later
  phases).
- Limitations: fixed windows allow boundary bursts; transactions add latency;
  counter documents need eventual cleanup; keys must be scoped carefully.
- Rate limiting is abuse control, not a WAF or a replacement for Firebase Auth
  quotas.

## 9. Audit logging

- Append-only entries for role grants, account-status changes, admin decisions,
  tournament changes, pot draws/shuffles, fixture generation, admin result
  entry/corrections, result-report decisions, announcements and archive actions.
- Each entry records actor UID, actor role, action, target type/id, optional
  tournament id, before/after values, reason and server timestamp.
- Written only by `src/lib/audit/log.ts` with the Admin SDK; readable only by
  Super Admin.

## 10. Data permanence

- Competition records, results and audit entries are never hard-deleted.
- Corrections create new state plus audit entries.
- Firestore backups and point-in-time recovery are configured in Phase 18.

## 11. Application hardening (Phase 18)

- Security headers (HSTS, CSP, frame ancestors, referrer policy, permissions
  policy).
- CSRF origin checks for cookie-based mutations.
- Dependency audits, secret scanning and rules tests in CI.
- No verbose production errors; redact secrets and personal data from logs.
- Privacy: collect only necessary data, document retention, provide export and
  account-deletion paths while preserving anonymised competition history.
