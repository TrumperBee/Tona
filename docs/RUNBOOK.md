# GCC Runbook

Operational guide for Global Champions Circuit. This is for maintainers/operators. Do not store secrets in this document.

## Deploy

1. Confirm `main` is green in CI (lint, typecheck, tests, rules, integration, format).
2. Ensure Vercel project env vars are set (see Launch Checklist). `NEXT_PUBLIC_SITE_URL` must be the production URL.
3. Deploy via Vercel Git integration (push to main) or `vercel --prod` from an authorized machine.
4. Verify `/api/health` returns `{"status":"ok"...}`.
5. Verify public pages load and sign-in works.

## Deploy Firestore rules and indexes

From a machine with Firebase CLI auth and correct project selected:

```bash
npm run rules:deploy
```

This deploys `firestore.rules` and `firestore.indexes.json`. Confirm project with `firebase use` before running.

## Rotate keys / credentials

### Firebase Admin service account

1. Create a new service account key in Google Cloud IAM for the Firebase project.
2. Update Vercel/server env vars: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
3. Redeploy.
4. Verify `/api/health/deep` (Super Admin) shows Firestore/Auth OK.
5. Disable/delete old key after confirmation.

### Cloudinary

1. Rotate API key/secret in Cloudinary dashboard.
2. Update `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Redeploy and test avatar/tournament logo upload.

### Resend

1. Rotate API key in Resend.
2. Update `RESEND_API_KEY`, keep `RESEND_FROM` verified.
3. Redeploy and send Super Admin test email.
4. If webhook secret rotated, update `RESEND_WEBHOOK_SECRET` and Resend webhook endpoint config.

### Turnstile

1. Rotate secret in Cloudflare Turnstile.
2. Update `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` if site key changed.
3. Redeploy and test login/register/contact forms.

## Ban / suspend user

Use Super Admin console: `/super-admin/users` -> user -> change status to suspended/banned as supported. Reason is required and audited. For emergency, suspend via Super Admin API/UI; do not edit Firestore manually unless incident requires it and action is audited afterward.

## Reverse accidental result

1. Use organiser/super-admin result correction flow in tournament workspace; provide reason.
2. Correction creates audit trail and recalculates standings/knockout as applicable.
3. If correction is blocked due to dependent knockout results, reset affected knockout stage only with explicit confirmation and understanding of impact. Prefer minimal correction.
4. Verify standings, match report, and notifications after correction.

## Reset fixtures / knockout

- Fixtures reset: organiser workspace fixtures action; only when allowed by product rules. This is destructive to generated fixtures/results as designed.
- Knockout reset: organiser workspace knockout reset; only before dependent irreversible progression where allowed. Record reason and confirm in UI.
- After reset, regenerate and verify before publishing.

## Recompute stats / rankings

Use Super Admin tools/endpoints where available (`/api/super-admin/stats/recompute` or console action). Run during low traffic. Verify Hall of Fame/rankings/player stats after completion.

## Run backups

```bash
npm run backup
```

- Requires Firebase Admin env vars.
- Script asks for explicit Firebase project id confirmation.
- Exports JSON to ignored `backups/<timestamp>/`.
- Treat backups as sensitive; they may contain personal data. Encrypt/store securely.
- See `scripts/ops/restore-note.md` for restore limitations.

## Handle email bounce spike

1. Check Resend dashboard and `/super-admin` email health/failures.
2. Verify `RESEND_FROM` domain/SPF/DKIM/DMARC.
3. Check `RESEND_WEBHOOK_SECRET` and webhook delivery.
4. Identify affected template/category; pause non-critical announcements if needed.
5. Do not disable critical account/security emails unless legally/operationally required.
6. Contact affected users through in-app/banner where appropriate.

## Free quota exceeded

Firebase Spark/Auth/Firestore/Cloudinary/Resend/Vercel all have limits.

- **Firestore reads/writes**: reduce polling, inspect expensive pages, use cached public reads, consider temporary maintenance mode.
- **Auth**: check abuse/rate limits; Turnstile and app checks should be enabled.
- **Resend**: check quota state in `/api/health/deep` (Super Admin), reduce optional email, prioritize critical.
- **Cloudinary**: limit upload size/frequency; clean unused assets only with care.
- **Vercel**: check function/runtime/log usage; optimize heavy routes.

If service degraded, enable maintenance mode from Super Admin settings (Super Admin remains exempt) and communicate via announcement/banner.

## Incident checklist

1. **Assess**: what is affected, who is affected, is data integrity at risk?
2. **Contain**: enable maintenance mode if writes are unsafe; disable affected feature flag/route if needed.
3. **Preserve evidence**: capture request IDs/reference IDs, Vercel logs, audit logs, relevant Firestore docs.
4. **Communicate**: post clear announcement/banner if user-facing.
5. **Fix**: smallest safe change; verify in staging/emulator where possible.
6. **Verify**: health, auth, critical flows, audit entries.
7. **Document**: incident summary, timeline, root cause, remediation, follow-up tasks.

## Uptime monitoring

Configure a free uptime monitor (UptimeRobot, Better Stack free tier, or equivalent) to GET `/api/health` every 1-5 minutes from at least one region. Alert on non-200 or timeout. Do not monitor `/api/health/deep` publicly; it requires Super Admin auth and performs dependency checks.

## Vercel log retention

Vercel log retention depends on plan. On Hobby/free plans, logs are short-lived and not a full audit trail. Use structured JSON logs with reference IDs (emitted by `src/lib/observability/logger.ts`) and preserve incident-relevant logs externally. Firestore `auditLogs` remains the durable audit record for privileged actions.
