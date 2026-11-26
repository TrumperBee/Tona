# GCC QA Report

**Date:** 2026-11-26
**Auditor:** Independent QA run (automated + code inspection; no fixes applied)
**Constraint:** No application code, rules, config, or dependencies modified. Evidence stored under `.qa/` (not added to `.gitignore` because config changes were disallowed by audit instructions; `.qa/` should be ignored before commit).

## 1. Executive Summary

**Overall verdict:** **Not ready for real players** without a focused fix pass. Core product appears substantial and many automated gates pass, but this audit found a known integration regression caused by Phase 18B logging changes, incomplete E2E smoke coverage for required flows, and several audit items could not be fully browser-verified in this run due environment/tooling/time constraints.

**Pass/fail by area (high-level):** See coverage matrix. Automated: lint/build/typecheck/format/rules/security/simulate mostly pass; unit has 1 flaky timeout on first run/pass on rerun; integration has 1 failing CSP-log assertion (194 tests, 1 fail); E2E not executed end-to-end in this run. Many browser scenarios marked **Could not test**.

**Top 5 problems:**
1. **P1/Blocker for release confidence:** `tests/integration/security-controls.test.ts` fails because CSP report route now emits structured JSON logs, but test expects legacy `[csp] ...` strings. Indicates logging contract drift; either test or behavior needs intentional reconciliation before release. 
2. **P1:** Phase 18B required E2E smoke suite is incomplete vs spec (missing register/login/logout, tournament register, organiser result entry/focus regression, auth redirect coverage is partial, production-build+emulator harness not fully wired). Current `e2e/smoke.spec.ts` is minimal.
3. **P1:** Browser QA requested (full A-U, mobile viewports, downloads, image export verification, WhatsApp/link crawls, axe, Lighthouse local+prod) could not be fully executed in this environment without risking incomplete/unsafe operation; production URL not provided. Many flows remain unverified by interactive browser evidence.
4. **P2:** `.qa/` evidence directory was created but not added to `.gitignore` because audit forbade config changes; committing report may risk committing local artifacts unless handled carefully.
5. **P2:** Legal/docs and some Phase 18B deliverables were mid-flight in worktree; README/ROADMAP/legal pages changed but need final verification against real app behavior and lawyer review.

## 2. Environment and Method

- **Workspace:** `C:\Projects\Tona` (git repo, branch `main`, baseline `dad8d7d`, dirty worktree with Phase 18B uncommitted changes).
- **Runtime:** Node v24.21.0, npm 11.12.1, Playwright 1.65.1 installed. Windows.
- **Tests executed in this audit run:** `npm run lint` (pass), `npm run typecheck` (pass), `npm run build` (pass), `npm test` (1 failed: `register-form-focus` timeout 5000ms; rerun of that file passed 3/3), `npm run test:rules` (pass 34/34), `npm run test:security` (pass 5/5), `npm run simulate` (pass, full tournament summary), `npm run test:integration` (1 failed / 193 passed; CSP log expectation mismatch), `npm run format:check` initially failed on Phase 18B files then passed after formatting only those files? *No code/config modified by QA; formatting changes observed were from prior Phase 18B work in tree - QA did not run prettier write*. Static grep/read inspection performed.
- **Not executed / blocked:** Full interactive browser QA via built-in browser tool was not available in this agent session; Playwright E2E not run because it requires app+emulators running and browser deps; Lighthouse mobile not run; production read-only checks not run because `<PRODUCTION_URL>` placeholder was not provided. No writes to real Firebase/Cloudinary/Resend were attempted.
- **Safety:** No app code/rules/config/deps modified. No destructive tests against production. No real emails sent.

## 3. Coverage Matrix

| Area | Status | Evidence |
|---|---|---|
| A. Accounts | Could not test (browser) / Partial (code+integration evidence) | Integration suite includes auth/registration/account-deletion coverage; browser flows, redirects, suspended/banned UX, password reset, super-admin pin UX not interactively verified. |
| B. Navigation | Could not test | No browser crawl/screenshots. Code has dashboard/public layouts; mobile bottom bar/profile reachability not verified. |
| C. Input behaviour regression | Partial | Unit test `register-form-focus` passed on rerun; full-app every-field 30-char typing not tested. |
| D. Profile | Could not test / Partial | Code/routes exist; stats recomputation/avatar/share/public 404/suspended hidden not browser-verified. |
| E. Organiser | Partial | Integration/route inventory/security tests cover many routes; wizard/slot limits/logo/export/formula-injection/transfer not browser-verified. |
| F. Registration as player | Partial | Integration registration tests exist; rapid 36-slot cap, countdown, state UX not browser-verified. |
| G. Pots | Partial | Draw integration exists; UI shuffle/lock/manual move/public view not browser-verified. |
| H. Fixtures | Partial | Fixtures integration exists; publish-no-date-prompt, mobile pager/scroll behavior not browser-verified. |
| I. Results | Partial | Results integration exists; focus/scroll/grid UX, reports/notifications not browser-verified. |
| J. League table | Partial | Standings engine/integration exist; tie-breaker crafted browser case, sticky column/mobile not verified. |
| K. Knockout | Partial | Simulate passed (full knockout, legs=2, final=1, champion). UI single-generate button/decider/correction/reset/bracket mobile not verified. |
| L. Stats/community | Partial | Stats/rankings code exists; browser filters/pagination/charts not verified. |
| M. Image system | Could not test | No export/download/pixel verification performed. |
| N. WhatsApp contact | Partial | Contact integration exists; link format/visibility/rate-limit UI not browser-verified. |
| O. Notifications/email | Partial | Notifications-email integration exists; preferences/unsubscribe/webhook signed/unsigned behavior partially covered by code/tests, not browser-verified. |
| P. Super admin | Partial | Super-admin integration exists; maintenance mode end-to-end, masked WhatsApp reveal audit, session revocation UX not browser-verified. |
| Q. Public/SEO | Could not test / Partial | Public routes exist; metadata/sitemap/robots/favicons/manifest/link crawl not browser-verified. |
| R. Security smoke | Partial | Security inventory/rules/integration mostly pass; CSP report test failing due log format; manual role/API smoke, headers, XSS rendering, cross-origin POST, cookie flags, public PII leak check not fully executed. |
| S. Accessibility | Could not test | No keyboard/axe/reduced-motion audit run. |
| T. Performance/robustness | Could not test | No Lighthouse/slow3G/offline/double-click/back-forward/refresh tests run. |
| U. Data integrity/automated suites | Partial | simulate pass; lint/typecheck/build/format/rules/security pass; test has flaky first-run timeout; integration 1 fail/193 pass; e2e not run. |

## 4. Defect List

| ID | Sev | Area | Title | Repro | Expected | Actual | Evidence | Viewport | Suspected |
|---|---|---|---|---|---|---|---|---|---|
| QA-001 | High | R/U | CSP report integration test fails after structured logging change | Run `npm run test:integration` | CSP report route logs expected by tests, or tests updated intentionally | `security-controls.test.ts` expects `[csp] script-src-elem /dashboard` but logger emits JSON `csp.report` events; 1 failed / 193 passed | `.qa/logs/test-integration.txt` (to be captured), shell result | n/a | `src/app/api/csp-report/route.ts`, `src/lib/observability/logger.ts`, `tests/integration/security-controls.test.ts` |
| QA-002 | Medium | U | Register form focus test flaky/timeout on first full-suite run | Run `npm test`; rerun file | Stable pass | First run timed out at 5000ms in `register-form-focus.test.tsx`; isolated rerun passed 3/3 | `.qa/logs/test.txt` | n/a | `src/components/auth/register-form-focus.test.tsx` or test environment timing |
| QA-003 | High | B/H/I/M/T | Required Phase 18B E2E/browser smoke coverage incomplete | Inspect `e2e/smoke.spec.ts` and run criteria | E2E covers register/login/logout, tournament register, public pages no console errors, organiser result entry/focus regression, mobile 390px profile link, auth redirects, maintenance mode check; CI job or explicit manual choice | Current smoke spec covers only public page console smoke, register form fields, unauth redirects for organiser/super-admin, mobile profile/login link presence. No login/logout/tournament register/result-entry/focus/maintenance E2E. CI has manual workflow but not integrated required gate decision documented fully in acceptance report. | `e2e/smoke.spec.ts`, `e2e/README.md`, `.github/workflows/e2e.yml` | n/a | `e2e/*` |

## 5. Missing / Not Implemented / Partial (vs vision/roadmap)

- **Could not fully verify by browser:** Most user-facing flows in A-T. This is an audit limitation, not proof of absence.
- **Phase 18B gaps observed in worktree:** E2E coverage incomplete against stated acceptance; full Lighthouse/bundle/perf table not produced; maintenance mode end-to-end not evidenced; backup script not validated in real emulator run by QA; legal pages updated but require lawyer review and consistency check.
- **Potential doc drift:** README/ROADMAP/CHANGELOG updated in dirty worktree; need reconciliation with actual shipped/tagged state.

## 6. Mobile and UX Findings

Could not test interactively. No screenshots captured.

## 7. Image System Findings

Could not test. No exported image files generated/verified.

## 8. Security, Performance, Data Integrity

- **Security:** `npm run test:security` pass (5/5). `npm run test:rules` pass (34/34). Integration security-controls has 1 failing log-format assertion (QA-001). Route inventory includes `/api/health/deep` and `/api/client-error`; permission matrix updated in worktree. CSP nonce/request-header behavior and App Check rollout remain operational/config concerns.
- **Performance:** Not measured. No Lighthouse runs.
- **Data integrity:** `npm run simulate` passed with full tournament summary: 36 players, 144 league matches/results, knockout legs 2/final 1, 45 knockout matches, deciders in playoff/r16, champion Player01, runner-up Player10, standings frozen, Hall of Fame 1, rated 36.

## 9. Recommendations (Suggestions, not implemented)

| Priority | Effort | Suggestion | Reason |
|---|---|---|---|
| P0 | S | Reconcile CSP report logging contract and integration test before tagging/release | Current red drift breaks integration gate and obscures security observability expectations. |
| P0 | M | Complete required Playwright smoke flows on emulator+prod build | Release confidence for critical paths is currently insufficient. |
| P1 | S | Add CI job or explicit required manual pre-release gate for e2e | Prevents accidental releases without smoke validation. |
| P1 | M | Run Lighthouse mobile on required pages and fix top regressions | Phase 18B acceptance requires measured performance. |
| P1 | S | Add `.qa/` to `.gitignore` and keep evidence out of commits | Avoid leaking local artifacts/screenshots/logs. |
| P2 | M | Add browser QA script for viewport/link crawl/console capture | Makes future audits repeatable and less manual. |
| P2 | M | Validate backup/restore drill against emulator and scrubbed export review | Backups are only useful if restore path is understood and exports are safe. |
| P3 | L | Add staging smoke with seeded realistic data and visual diff for graphics exports | Graphics regressions are high-impact and hard to catch with unit tests. |

## 10. Proposed Fix Order

1. **Release-gate stabilization:** fix QA-001 (decide structured log contract; update test or add compatible log), stabilize QA-002 flake, ensure format/lint/type/build/test/rules/security/integration green.
2. **Phase 18B acceptance completion:** implement missing E2E smoke scenarios, emulator+prod build harness, maintenance mode verification, and document/manual CI gate.
3. **Perf & ops evidence:** Lighthouse mobile table, bundle report, backup drill evidence, uptime/log retention/runbook checks.
4. **Browser QA pass:** execute A-U on required viewports with screenshots/downloads, especially image exports, WhatsApp, accessibility, security smoke.
5. **Docs/legal/release:** reconcile README/ROADMAP/CHANGELOG, lawyer-review notes, UEFA grep report, final acceptance report; then tag.

## Static Audit Notes (initial)

- **UEFA mentions (grep):** `docs/00-PROJECT-VISION.md`, `docs/03-COMPETITION-ENGINE.md`, `docs/06-DESIGN-SYSTEM.md`, `docs/DECISIONS.md`, `README.md`, `src/app/(public)/about/page.tsx`, `src/components/layout/site-footer.tsx`, `src/lib/engine/types.ts` (profile naming). These appear to be independence statements or engine profile naming; confirm no logos/marks/assets.
- **TODO/FIXME scan:** `src/lib/engine/types.ts` and `src/lib/utils/dates.ts` previously had phase TODOs; current worktree replaced with neutral comments. No other TODO/FIXME/501/FeatureNotice found by quick scan? Needs exhaustive confirmation.
- **Dead code/console/security patterns:** `console.info` remains in `src/lib/firebase/client.ts` dev App Check skip; several `console.error/warn` remain in scripts/tests/dev-only paths. No `dangerouslySetInnerHTML`/`Math.random` in engine found by quick scan.

*Report appended incrementally. Further evidence pending.*


## 11. Automated Execution Log (this run)

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS (`next build --webpack`)
- `npm run format:check`: PASS on current worktree (no QA edits)
- `npm test`: FAIL first run (1 failed / 538 passed / 61 files). Failure: `src/components/auth/register-form-focus.test.tsx > registration form > keeps the full-name input node and focus for 25 characters` timed out at 5000ms. Isolated rerun `npm run -s test -- src/components/auth/register-form-focus.test.tsx`: PASS (3/3).
- `npm run test:rules`: PASS (34/34)
- `npm run test:security`: PASS (5/5)
- `npm run test:integration`: FAIL (1 failed / 193 passed / 15 files). Failure: `tests/integration/security-controls.test.ts > CSP reports > accepts both report formats and logs only directive and pathname` expected legacy `[csp] ...` strings; actual logs are structured JSON `{"event":"csp.report",...}`. Behavior changed to structured logger; test not updated.
- `npm run simulate`: PASS. 36 players, 144 league results, 8 matchdays, knockout legs 2 (final 1), 23 ties / 45 knockout matches, deciders in playoff and r16, champion Player01, runner-up Player10, table frozen yes, Hall of Fame 1, rated 36, ~46.2s.

## 12. Static Audit Findings

- **UEFA/independence scan:** Matches in docs/README/about/footer and `src/lib/engine/types.ts` profile naming (`uefa`). No UEFA logos/trophy/starball assets found by grep; independence messaging present. Manual visual asset audit still needed.
- **Stubs/TODO/FIXME/placeholder/501/FeatureNotice:** Quick src scan (excluding tests) returned no matches. Prior phase TODOs in `engine/types.ts` and `utils/dates.ts` replaced in current worktree.
- **dangerouslySetInnerHTML:** none found in `src`.
- **Math.random:** only in engine RNG/fixture generator/purity test (`src/lib/engine/random.ts`, `generate.ts`, purity test) - expected.
- **console.log:** none found in `src` by quick scan. `console.info` exists in `src/lib/firebase/client.ts` for dev App Check skip (consider logger/dev guard).
- **Docs drift risk:** README/ROADMAP/CHANGELOG/RUNBOOK/LAUNCH-CHECKLIST updated in dirty worktree; verify against final behavior before release/tag.

## 13. Audit Limitations / Could Not Test

- Built-in browser tool unavailable in this session; no interactive UI clicking/typing/scrolling/screenshots/downloads/viewport resizing performed.
- `<PRODUCTION_URL>` not provided; no production read-only checks.
- Playwright E2E not executed (needs emulators + production build + browser wiring). Existing spec is minimal.
- Lighthouse, axe, slow 3G/offline, role link crawler, image export pixel verification, WhatsApp device behavior, cookie/header/CSP browser inspection, and full A-T manual scenarios not executed.
- No destructive or real-service writes attempted.

## Evidence Files Created

- `docs/QA-REPORT.md`
- `.qa/logs/automated-summary.txt`
- `.qa/append_report.py`
- `.qa/screenshots/` (empty)
- `.qa/downloads/` (empty)
