# GCC Launch Checklist

Manual pre-launch steps. Complete every item before public launch. Keep secrets in env/secret manager, never in git.

## Firebase

- [ ] **Authorized domains**: Firebase Console -> Authentication -> Settings -> Authorized domains. Add production domain(s), Vercel preview domain only if needed, and remove stale domains.
- [ ] **Super Admin account**: ensure `SUPER_ADMIN_EMAIL` account exists; set `SUPER_ADMIN_UID` to that exact Firebase Auth UID. Verify sign-in grants Super Admin.
- [ ] **Firestore rules/indexes deployed**: `npm run rules:deploy` against production project. Confirm indexes are built.
- [ ] **TTL policies**: confirm TTL on `rateLimits.expiresAt` and any other configured TTL fields in Firebase Console. TTL deletion is asynchronous (can take up to ~24h).
- [ ] **App Check**: register web app in Firebase App Check, create reCAPTCHA v3 site key, set `NEXT_PUBLIC_APPCHECK_SITE_KEY`. Monitor App Check metrics for 3-5 days at >=99% verified requests before enforcing. Enforce Auth first, then Firestore after stability.
- [ ] **Auth providers/settings**: confirm Email/Password enabled; email enumeration protection considered; authorized domains correct.

## Vercel / domain

- [ ] **Custom domain**: add domain in Vercel project settings, configure DNS records as Vercel instructs, verify HTTPS certificate.
- [ ] **Environment variables** (Production, and Preview if needed):
  - Public: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (if used), `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_SITE_URL=https://<production-domain>`, `NEXT_PUBLIC_EHUBMARKET_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_APPCHECK_SITE_KEY`.
  - Server-only: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_UID`, `SESSION_COOKIE_MAX_AGE_DAYS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `CSP_MODE` (leave blank/enforce for production; `report-only` only during staged rollout).
- [ ] **Redeploy** after env changes.

## Cloudinary

- [ ] Create/configure cloud, folder/preset conventions as used by app.
- [ ] Set API key/secret in env. Verify avatar and tournament logo/cover upload in production.

## Resend

- [ ] Verify sending domain and `RESEND_FROM`.
- [ ] Set `RESEND_API_KEY`.
- [ ] Configure webhook endpoint to `https://<domain>/api/webhooks/resend` with events needed for bounces/complaints/delivery. Set `RESEND_WEBHOOK_SECRET`.
- [ ] Send Super Admin test email from `/super-admin` console.

## Turnstile / CSP

- [ ] Create Cloudflare Turnstile widget for production domain. Set site/secret keys.
- [ ] Confirm CSP mode. Production default is enforce; use `CSP_MODE=report-only` only for staged rollout and monitor `/api/csp-report` logs before enforcing.

## Data / content

- [ ] Run `npm run dev:seed cleanup` in development/emulator as needed to remove local seeded test data. **Do not run destructive cleanup against production unless explicitly intended.**
- [ ] Delete any seeded/test tournaments/users from production Firestore/Auth if created during rehearsals.
- [ ] Review legal pages (Terms, Privacy, Organiser Code) with qualified lawyer before wide launch.
- [ ] Confirm independence notice appears in footer/legal pages; no UEFA marks/logos.

## First real tournament

- [ ] Super Admin creates/approves organiser as needed.
- [ ] Organiser creates first real tournament, sets rules/schedule/capacity.
- [ ] Publish tournament and open registration only when ready.
- [ ] Invite first players via trusted channels.

## Smoke test on real phone

- [ ] Open home, tournaments, tournament detail, registration/login.
- [ ] Register/login/logout.
- [ ] Register for open tournament (if applicable) and withdraw flow sanity check.
- [ ] Check dashboard, notifications, profile.
- [ ] Check organiser workspace/result entry on mobile 390px viewport.
- [ ] Confirm no blocking console errors and maintenance banner behavior if toggled.

## Post-launch

- [ ] Configure uptime monitor for `/api/health`.
- [ ] Review Vercel logs and Super Admin `/api/health/deep`.
- [ ] Monitor App Check metrics before enforcement.
- [ ] Schedule first backup and verify `backups/` artifact handling.
