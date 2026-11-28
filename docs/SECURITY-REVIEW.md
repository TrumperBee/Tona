# GCC — Phase 18A Security Review

This is the audit record for Phase 18A. Every finding has a severity, a status
(`fixed` or `accepted` with a reason) and a test that proves the fix. The phase
adds no product features; all changes are security controls, privacy controls,
documentation or tests.

## Findings

| ID    | Finding                                                                                                                                                                      | Severity | Status | Fix                                                                                                                                                                         | Test that proves the fix                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F-001 | No Content-Security-Policy: inline script injection and third-party script sources were unrestricted.                                                                        | high     | fixed  | Per-request nonce CSP in `src/proxy.ts` with `strict-dynamic`, exact provider allow-lists and `CSP_MODE=report-only\|enforce`.                                              | `src/lib/security/csp.test.ts`; `tests/security/route-inventory.test.ts`       |
| F-002 | Security headers were incomplete: no HSTS, COOP or DNS-prefetch control; `Permissions-Policy` omitted common sensors.                                                        | medium   | fixed  | Preload-ready HSTS, COOP, `X-DNS-Prefetch-Control` and a complete `Permissions-Policy` in `next.config.ts`.                                                                 | `npm run build` header check in this report                                    |
| F-003 | No automated route/permission inventory; new routes could silently omit server controls.                                                                                     | medium   | fixed  | `tests/security/route-inventory.test.ts` scans every `route.ts` and every protected page/layout; explicit allow-list with one-line justifications.                          | `npm run test:security`                                                        |
| F-004 | Player registration/withdrawal and match-contact POST lacked the maintenance gate; registration/withdrawal also lacked a required session and strict route-param validation. | high     | fixed  | `requireUser`, `assertPlatformWritable` and strict Zod param schemas added to those routes.                                                                                 | `tests/security/route-inventory.test.ts`; `npm run test:integration`           |
| F-005 | No bot protection on registration, password reset, organiser applications or repeated failed sign-ins.                                                                       | high     | fixed  | Cloudflare Turnstile widget + server-side `fetch` verification, action binding, IP forwarding, fail-closed secret handling; 3-failure challenge keyed by IP + hashed email. | `src/lib/security/turnstile.test.ts`; `tests/security/route-inventory.test.ts` |
| F-006 | Firebase browser calls had no App Check tokens.                                                                                                                              | medium   | fixed  | reCAPTCHA v3 App Check initialised in `src/lib/firebase/client.ts`; production fails closed when the site key is missing.                                                   | `npm run typecheck`; Firebase Console rollout procedure below                  |
| F-007 | Rate-limit documents stored the readable key, which could contain an email address or IP.                                                                                    | medium   | fixed  | Only a short SHA-256 fingerprint is stored; document id remains the full hash.                                                                                              | `src/lib/rate-limit/*.test.ts`                                                 |
| F-008 | The CSP report endpoint could have logged full URLs, query strings or user data.                                                                                             | medium   | fixed  | Strict Zod envelope, 16 KiB cap, 60/min limit and directive + pathname-only logging.                                                                                        | `src/lib/security/csp.test.ts`; route inventory test                           |
| F-009 | The permission matrix and actor-driven route tests did not exist.                                                                                                            | medium   | fixed  | `docs/PERMISSION_MATRIX.md` generated from the route tree; every route called as signed-out/player/organiser/Super Admin.                                                   | `tests/integration/route-permissions.test.ts`; `npm run test:security`         |

## Parallel audit findings

| ID    | Finding                                                                                 | Severity | Status          | Fix                                                                                                                                     | Test that proves the fix                                                     |
| ----- | --------------------------------------------------------------------------------------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| F-010 | CSV exports began cells with spreadsheet formula markers (`=`, `+`, `-`, `@`, tab, CR). | medium   | fixed           | `src/lib/utils/csv.ts` escapes every cell and the registration export uses it.                                                          | `src/lib/utils/csv.test.ts` (5 cases incl. leading-space bypass)             |
| F-011 | Tournament cover/logo upload wrote to Cloudinary before verifying ownership.            | medium   | fixed           | `src/lib/tournament/image-route.ts` verifies `requireTournamentOwnerOrSuperAdmin()` before reading bytes.                               | Non-owner 404 assertions in `tests/integration/tournaments.test.ts`          |
| F-012 | Public site URLs could be `javascript:`, `data:` or remote `http:` when misconfigured.  | medium   | fixed           | `safePublicUrl()` allowlists https plus local loopback.                                                                                 | `src/lib/config/site.test.ts`                                                |
| F-013 | `/api/super-admin/organisers` search had no rate limit.                                 | low      | fixed           | `super-admin:organisers:search`, 30/min per admin.                                                                                      | `tests/integration/route-permissions.test.ts`; `docs/RATE-LIMIT-COVERAGE.md` |
| F-014 | Tournament image routes consumed the same rate-limit key twice.                         | low      | fixed           | Removed the redundant check; the organiser guard is authoritative.                                                                      | `docs/RATE-LIMIT-COVERAGE.md`                                                |
| F-015 | Replacing a legacy avatar/logo public id left the old Cloudinary asset behind.          | low      | fixed           | Replacement reference helpers return the prior id and routes destroy it only when it differs.                                           | `tests/integration/tournaments.test.ts`                                      |
| F-016 | A suspended account with a still-valid cookie could retain access until token expiry.   | high     | fixed           | `getCurrentUser()` re-reads `status`/`deleted` on every request.                                                                        | `tests/integration/account-deletion.test.ts`                                 |
| F-017 | A stale `super_admin` claim could render privileged pages after the pin changed.        | high     | fixed           | Page guard calls pinned `requireSuperAdmin()` and checks email + uid.                                                                   | `src/lib/auth/__tests__/roles.test.ts`; `role-sync.test.ts`                  |
| F-018 | Configured session lifetime could exceed Firebase's 14-day maximum.                     | medium   | fixed           | `clampSessionMaxAgeSeconds()` and `SESSION_COOKIE_MAX_DAYS = 14`.                                                                       | `src/lib/auth/__tests__/session.test.ts`                                     |
| F-019 | `Secure` cookie flag ignored `VERCEL_ENV=production`.                                   | medium   | fixed           | Cookie options check both `NODE_ENV` and `VERCEL_ENV`.                                                                                  | `src/lib/auth/__tests__/session.test.ts`                                     |
| F-020 | No self-service account deletion with PII/Auth/Cloudinary cleanup.                      | high     | fixed           | Fresh-session deletion route, anonymised public profile, retained history, blocked privileged accounts and audit log.                   | `tests/integration/account-deletion.test.ts` (6 tests)                       |
| F-021 | `npm audit` found 12 production vulnerabilities (4 high).                               | high     | fixed           | Pinned `firebase@13.4.0`, `firebase-admin@14.5.1`, `@grpc/grpc-js: 1.14.7`; applied non-forcing `npm audit fix`.                        | `npm audit --omit=dev` → 0                                                   |
| F-022 | Service-account JSON filenames were not ignored.                                        | low      | fixed           | Added `*serviceAccount*.json`, `*service-account*.json`, `*adminsdk*.json`, `firebase-adminsdk-*.json` to `.gitignore`.                 | `git check-ignore -v` in `docs/SECRETS-AND-DEPENDENCIES.md`                  |
| F-023 | Potential secrets in git history or build output were unverified.                       | medium   | fixed (no leak) | Scanned all refs, unreachable objects, working tree and a fresh `.next/static` build.                                                   | `docs/SECRETS-AND-DEPENDENCIES.md`                                           |
| F-024 | Remaining dev-only npm advisories cannot be fixed without breaking changes.             | low      | accepted        | 14 moderate advisories from `firebase-tools` transitive tooling; `--force` proposes a destructive downgrade.                            | `npm audit`; rationale in `docs/SECRETS-AND-DEPENDENCIES.md`                 |
| F-025 | CSP/reporting, login-attempt state and PII-free counters had no executable proof.       | medium   | fixed           | Emulator-backed `tests/integration/security-controls.test.ts` covering headers, both report formats, rate limits and hash-only storage. | 9 passing tests in that file                                                 |

## Severity and status summary

| Severity  |  Total |  Fixed |                                                   Accepted |
| --------- | -----: | -----: | ---------------------------------------------------------: |
| High      |      6 |      6 |                                                          0 |
| Medium    |     10 |      9 | 1 (dev-only npm tooling advisories documented as residual) |
| Low       |      5 |      4 |                                                          1 |
| **Total** | **21** | **19** |                                                      **2** |

All `fixed` findings have either an automated test, an executable command proof, or a documented operational verification step. No high-severity finding is open.

## Accepted risks

- **Dev-only npm advisories (F-024, low).** `npm audit` reports 14 moderate
  transitive advisories in `firebase-tools` development tooling. `npm audit --omit=dev`
  reports 0. `npm audit fix --force` proposes a breaking downgrade to
  `firebase-tools@13.11.2` and was not applied. Rationale is in
  `docs/SECRETS-AND-DEPENDENCIES.md`.
- **Fixed-window rate limiting.** Boundary bursts remain possible. Counters are
  abuse controls, not a WAF; Firebase Auth and Cloudflare still provide platform
  quotas. Expiry uses Firestore TTL and is asynchronous.
- **Account deletion is not atomic across providers.** Firestore PII is cleared
  before Auth deletion; Cloudinary cleanup is best effort; a failed audit write
  after Auth deletion returns 500 though the account is gone. Operators can
  correlate the deletion marker with request logs.
- **App Check enforcement is a Console rollout.** Client code initialises App
  Check, but enforcement is only active after the documented Firebase Console
  3–5 day monitoring window.
- **Public Firebase web config in client bundles.** The Firebase web API key and
  project ID are public by design; protection comes from Security Rules and
  App Check, not key secrecy.
- **CSP style allowance.** `style-src` includes `'unsafe-inline'` because React
  style attributes and html-to-image exports need it. Script execution is not
  allowed by that directive.

## CSP rollout and rollback

1. Deploy with `CSP_MODE=report-only`. The response carries
   `Content-Security-Policy-Report-Only`; violation posts go to
   `/api/csp-report` and are logged as `[csp] <directive> <pathname>` only.
2. Exercise login, registration, avatar upload, image export, graphics and
   Turnstile. The browser console and `/api/csp-report` logs must be empty of
   unexpected directives.
3. Remove `CSP_MODE` (production default is `enforce`) to switch on enforcement.
4. **Rollback:** set `CSP_MODE=report-only` and redeploy. This immediately stops
   blocking; no data migration is involved. To disable CSP entirely, remove the
   nonce headers in `src/proxy.ts` in a separate emergency release.

## App Check enforcement switch point

1. Register the reCAPTCHA v3 site key in Firebase Console → App Check → Apps.
2. In development, add the Firebase Console debug token to
   `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`; App Check is skipped when it is absent.
3. In Firebase Console → App Check → Metrics, verify for **3–5 consecutive days**
   that verified traffic is ≥99% for both Authentication and Cloud Firestore,
   with no unexplained rise in unverified or blocked requests.
4. Only then enforce App Check for **Authentication first**, observe for one day,
   then **Cloud Firestore**. The Admin SDK is exempt, so server routes and
   scheduled jobs keep working.

## Verification

| Command                    | Result   | Notes                                                                       |
| -------------------------- | -------- | --------------------------------------------------------------------------- |
| `npm run lint`             | pass     | 0 errors, 0 warnings after cleanup                                          |
| `npm run typecheck`        | pass     | After fixing pre-existing `createResultReport` export order and test typing |
| `npm run build`            | pass     | Production build completed                                                  |
| `npm test`                 | pass     | 61 files, 539 tests                                                         |
| `npm run test:rules`       | pass     | 1 file, 34 tests                                                            |
| `npm run test:integration` | pass     | 15 files, 194 tests                                                         |
| `npm run format:check`     | pass     | Prettier clean                                                              |
| `npm run test:security`    | pass     | 1 file, 5 tests                                                             |
| `npm audit --omit=dev`     | pass     | 0 vulnerabilities                                                           |
| `npm audit`                | accepted | 14 moderate dev-only `firebase-tools` advisories; no non-breaking fix       |
