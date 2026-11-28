# Changelog

## v1.0.0 - 2026-11-26

Initial production launch readiness release for Global Champions Circuit (GCC).

### Added

- Phase 18B operations and launch readiness: backup export script (`npm run backup`), restore notes, `/api/health/deep` Super Admin dependency check, structured server logger with redaction, client error reporting endpoint, global error boundary.
- Playwright smoke E2E scaffold (`npm run e2e`) for critical public/auth/tournament flows; CI/manual guidance documented.
- Runbook and launch checklist docs.
- Legal/policy updates covering accounts/passwords, WhatsApp sharing model, Resend/Cloudinary/Firebase services, admin-entered results, result reports, retention/account deletion, cookies/session, minimum age (13+), Kenya Data Protection Act 2019 neutral reference, and lawyer-review note.

### Changed

- `/api/health` remains fast liveness probe; deep checks moved to authenticated `/api/health/deep`.
- Server route logging standardized through redacted structured logger for key paths.
- Error boundaries show friendly message with reference ID.

### Security / Operations

- Maintenance mode verified as platform write gate; Super Admin exempt.
- Backup export requires explicit Firebase project id confirmation; backups are gitignored and treated as sensitive.
- Uptime monitoring and Vercel log retention documented.

### Notes

- Firebase App Check enforcement remains a console rollout after 3-5 days >=99% verified traffic (Auth first, then Firestore).
- CSP defaults to enforce in production; `CSP_MODE=report-only` is rollback/staged rollout option.
