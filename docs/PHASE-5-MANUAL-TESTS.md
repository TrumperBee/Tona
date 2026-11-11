# Phase 5 manual acceptance script — Super Admin console

> Historical acceptance record. Email-verification steps in this script describe
> the Phase 5 product; verification was removed in Phase 8B (ADR-046). The
> Super Admin is now pinned by `SUPER_ADMIN_EMAIL` **and** `SUPER_ADMIN_UID`.

Run this script against **either** a local emulator stack or a real Firebase
project. Record which environment you used; the two are not interchangeable
evidence.

## 0. Environment and prerequisites

### Option A — local emulators (no production data)

```bash
# Terminal 1
npm run emulators

# Terminal 2 — point the app at the emulators
npm run dev
```

Use the Auth emulator's generated accounts. The Super Admin is the account whose
email matches `SUPER_ADMIN_EMAIL` in `.env.local` (`owner@example.com` by
default in the integration setup). Create it through the app or Firebase
Console, verify its email, and sign in once so the `super_admin` claim and
session cookie are issued.

### Option B — real Firebase project

1. Copy the real `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_*` values into
   `.env.local`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
2. Confirm `localhost` is an authorised Auth domain.
3. Sign in as the configured Super Admin.

Before testing, confirm no fake data exists. `users`, `publicProfiles`,
`announcements`, `auditLogs` and `platformStats` should contain only records
created below.

## 1. Access control

- [ ] Signed out, open `/super-admin` → redirected to `/login`.
- [ ] Signed in as a participant, open `/super-admin` and every sub-page
      (`/settings`, `/users`, `/audit-log`, `/announcements`, `/analytics`,
      `/tournaments`) → not rendered as the console; the server redirects or
      denies. No data is shown before the check.
- [ ] Signed in as an organiser, repeat the same checks → denied.
- [ ] Signed in as the Super Admin, every page renders real data.
- [ ] Use a REST client to send each `/api/super-admin/*` mutation as a
      participant → `403`. Send one with no cookie → `401`. Send one with a
      foreign `Origin` header → `403`.

## 2. Overview

- [ ] `/super-admin` shows real counters: total users, active/suspended/banned,
      organisers, tournaments by status, pending applications, registrations and
      recent signups.
- [ ] Counters match Firestore. They are not hardcoded and the page does not read
      whole collections.
- [ ] The latest 10 audit entries appear with human-readable descriptions.
- [ ] Quick links open Settings, Users, Audit log, Announcements and Analytics.
- [ ] The system health card reports the real availability of the dependencies it
      checks; it does not claim a green state it cannot verify.
- [ ] With an empty database, cards show zero and empty states, not sample data.

## 3. Settings

- [ ] `/super-admin/settings` loads the current document, or the documented
      defaults when `platformSettings/main` does not exist.
- [ ] Save with a blank reason → rejected server-side.
- [ ] Set `maxActiveTournamentsPerOrganiser` to `0` and `21` → rejected. `1` and
      `20` → accepted.
- [ ] Set `applicationCooldownDays` to `-1` and `91` → rejected. `0` and `90` →
      accepted.
- [ ] Turn maintenance mode on with a message over 300 characters → rejected.
- [ ] Save valid settings. Firestore `platformSettings/main` contains the values,
      `updatedBy` is the acting UID and `updatedAt` is a server timestamp.
- [ ] `auditLogs` contains a `platform.settings.updated` entry with before/after
      values and the reason.
- [ ] As a participant, `GET` of `platformSettings/main` through the client SDK is
      denied by rules.

## 4. Maintenance mode

- [ ] Turn maintenance mode on with the message “Back at 18:00 UTC.”
- [ ] The public site, auth pages, dashboard, organiser and Super Admin shells all
      show the maintenance banner with that message.
- [ ] As a participant, save a profile edit → `503` with the configured message.
- [ ] As a participant, upload or remove an avatar → `503`.
- [ ] As a participant, submit `/api/auth/register` → `503`; no Auth user or
      Firestore document is created.
- [ ] Sign out and try to sign in during maintenance. The session exchange is
      blocked with the same message, and no new session cookie is issued.
- [ ] As the Super Admin, save settings, change a user status and create an
      announcement → all succeed while maintenance is on.
- [ ] Turn maintenance mode off. Participant writes work again.

## 5. Registrations closed

- [ ] Turn `registrationsOpen` off.
- [ ] `/api/auth/register` returns a clear rejection and creates nothing.
- [ ] Existing signed-in users can still edit their profile.
- [ ] Turn it back on; registration works.

## 6. Users list and search

- [ ] `/super-admin/users` lists users newest first, 20 per page, with avatar,
      gamer tag, name, email, country, role, status and joined date.
- [ ] Next/Previous pagination uses cursors. Page 2 does not repeat or skip a
      record when a user is created between requests.
- [ ] Filter by role, status, country and game individually and together. Results
      match Firestore; each combination is backed by an index.
- [ ] Search an exact email → exactly that user.
- [ ] Search a gamer-tag prefix (e.g. `Play`) → matching tags only.
- [ ] Clear filters → the full newest-first list returns.
- [ ] Enter a search with no matches → a clear empty state.
- [ ] On a narrow viewport, rows become readable cards; no horizontal scrolling.

## 7. User detail

- [ ] Open a user. The page shows Auth verification state, disabled state, last
      sign-in, memberships, application history and that user's audit entries.
- [ ] The WhatsApp number is masked (`+254 7•• ••• 678`), never full.
- [ ] Press “Reveal contact”. The full number appears once, and a new
      `user.contact_revealed` audit entry exists. The audit entry does **not**
      contain the number.
- [ ] Suspend the user with a reason. Auth is disabled, `users/{uid}.status` and
      `publicProfiles/{uid}.status` both read `suspended`, refresh tokens are
      revoked, and a `user.status.set` entry has before/after and the reason.
- [ ] Visit that user's public profile → “Profile unavailable”, no live details.
- [ ] Try to sign in as the suspended user → rejected with the account-status
      message.
- [ ] Restore the user without a reason → rejected. Restore with a reason →
      succeeds, Auth is enabled and both statuses read `active`.
- [ ] Try to act on your own Super Admin account → rejected.
- [ ] Create a second `super_admin` (test environment only) and try to act on it
      → rejected.
- [ ] Revoke an organiser's role with a reason → claims and `users.role` become
      `user`, refresh tokens are revoked, and a `user.role.set` entry exists.
- [ ] There is no control to create an admin or promote anyone.

## 8. Audit viewer

- [ ] `/super-admin/audit-log` lists entries newest first, 20 per page.
- [ ] Filter by action, actor and target; combine them.
- [ ] Filter by date range. Out-of-range entries disappear.
- [ ] Expand an entry. Before/after JSON is visible and redacted: no password,
      token, secret or phone number.
- [ ] The viewer has no edit or delete control. A client write to `auditLogs` is
      denied by rules.

## 9. Announcements

- [ ] Create a draft with title, body, severity, pinned and no expiry. It is
      saved with `publishedAt: null`, and an `announcement.created` entry exists.
- [ ] Edit the draft. `announcement.updated` records before/after.
- [ ] Publish it. `publishedAt` is set and `announcement.published` exists.
- [ ] Signed in, the site banner shows the notice. Dismiss it → it stays dismissed
      after a reload. Clear `localStorage` → it returns.
- [ ] `/announcements` lists it publicly with severity and date.
- [ ] Unpublish it. The banner and public page no longer show it;
      `announcement.unpublished` exists.
- [ ] Re-publish, then delete it. `deletedAt` is set, `publishedAt` is cleared,
      it disappears publicly, and `announcement.deleted` exists.
- [ ] Set an expiry in the past → the public page and banner hide it even though
      `publishedAt` is set.
- [ ] Signed out, a client read of a draft or deleted announcement is denied;
      a published, unexpired notice is readable.
- [ ] Enter a 101-character title or 2001-character body → rejected.
- [ ] The footer links to `/announcements`.

## 10. Analytics

- [ ] `/super-admin/analytics` shows 30-day signups and top-10 countries, games
      and platforms as accessible SVG charts.
- [ ] Charts have text alternatives or accessible labels; colour is not the only
      meaning.
- [ ] With real users, the totals match Firestore `count()` results. Breakdowns
      show how many users were sampled.
- [ ] With no tournaments or matches, those panels show an honest empty state,
      not zeroed charts implying activity.
- [ ] The cached summary is used for up to five minutes; the page labels it as
      cached/stale rather than live.
- [ ] Press Refresh → `platformStats/summary` is rewritten and the timestamp
      updates.
- [ ] A participant calling `POST /api/super-admin/analytics/refresh` → `403`.

## 11. Tournaments (read-only)

- [ ] `/super-admin/tournaments` lists tournaments with cursor pagination and a
      status filter and name search.
- [ ] With no tournaments, the empty state says there are none yet; it does not
      invent rows.
- [ ] Rows expose no create, edit, publish or delete action.

## 12. Rules, indexes and deployment

- [ ] `npm run test:rules` passes (announcement visibility and settings privacy
      included).
- [ ] `npm run test:integration` passes (403/401 matrix, status/role/contact,
      maintenance and announcements).
- [ ] `npm run rules:deploy` finishes with indexes enabled and no index errors.
- [ ] No client Firestore write path exists anywhere in the console.
