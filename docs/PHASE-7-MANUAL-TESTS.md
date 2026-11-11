# Phase 7 manual acceptance script — organiser workspace

> Historical acceptance record. Email-verification steps in this script describe
> the Phase 7 product; verification was removed in Phase 8B (ADR-046). The Super
> Admin now requires `SUPER_ADMIN_EMAIL` **and** `SUPER_ADMIN_UID`.

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

You also need:

- One participant account with a **verified** email.
- One **organiser** account: follow the Phase 6 script (apply, then have the
  Super Admin approve the application) so the `organiser` claim exists and
  `organiserProfiles/{uid}` was prefilled from the application's community
  name.
- A second organiser account for the ownership checks.

### Option B — real Firebase project

1. Copy the real `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_*` values into
   `.env.local`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
2. Confirm `localhost` is an authorised Auth domain.
3. Create the accounts above the same way (Phase 6 approval for organisers).

### Seeding tournaments

Tournament creation arrives in Phase 8, so seed real competition documents by
hand for this script. Use the Firestore console (emulator UI at
`localhost:4000` or the Firebase Console) and create documents under
`tournaments/{id}` with at least: `ownerUid` (the organiser's UID), `slug`,
`name`, `description`, `gameId` (`efootball`), `formatId`
(`ucl-league-phase-36`), `coverImageUrl: null`, `rulesSummary`,
`matchDurationMinutes: 10`, `timezone`, `registrationOpensAt`,
`registrationClosesAt`, `startsAt`, `maxParticipants: 36`,
`registrationCount`, `status`, `season`, `createdAt`, `updatedAt`. Seed several
statuses: `draft`, `registration_open` (one closing within 48 hours, one with
`registrationCount: 36`), `registration_closed`, `suspended`, `completed`,
`cancelled`. These are real documents the platform then reads — never mock data
inside the app.

Before testing, confirm `platformSettings/main` is absent or shows the values
you want to test with (default `maxActiveTournamentsPerOrganiser: 3`).

## 1. Organiser area access control

- [ ] Signed out, open `/organiser` → redirected to `/login`.
- [ ] Signed in as a plain participant → redirected to `/dashboard`.
- [ ] Signed in as an organiser → the dashboard renders.
- [ ] Signed in as the Super Admin → the dashboard renders with the slot-limit
      exemption notice.
- [ ] `/organiser/settings`, `/organiser/tournaments` and every workspace tab
      enforce the same role gate.
- [ ] The shell shows the notifications bell with the correct unread count
      (Phase 6).

## 2. Organiser profile bootstrap

- [ ] The organiser approved through Phase 6 has an `organiserProfiles/{uid}`
      document whose `organisationName` equals the application's community name
      (not the gamer tag) — created idempotently at approval time.
- [ ] An organiser with no application (role set by hand in a test
      environment) gets a profile prefilled with their public gamer tag on
      first visit to `/organiser/settings`.
- [ ] A public tournament detail page shows "Organised by" with the
      organisation name and links to `/organisers/{uid}`.
- [ ] `/organisers/{uid}` shows the profile, bio, logo and links for a
      signed-out visitor; an unknown uid shows the honest "no such organiser"
      state, never a fabricated profile.

## 3. Profile editing

- [ ] Save an organisation name of 2–60 characters, a bio ≤ 300 characters and
      up to three `https://` links → the page and `/organisers/{uid}` update.
- [ ] An organisation name of 1 or 61 characters → rejected with a field error.
- [ ] A link with `http://` or `javascript:` URL → rejected; `https://` only.
- [ ] More than three links → rejected. A link with an empty label or URL →
      dropped client-side, never saved as a blank row.
- [ ] A payload with an extra unknown field (e.g. `"uid"`, `"logoUrl"`,
      `"role"`) → rejected by the strict schema; identity, logo references and
      timestamps are server-written only.
- [ ] REST client: PATCH `/api/organiser/profile` with no cookie → `401`; as a
      participant → `403`; with a foreign `Origin` → `403`; while maintenance
      mode is on → `503`; more than 20 saves in 10 minutes → `429`.
- [ ] An `organiser_profile.updated` audit entry exists with before/after.

## 4. Logo upload

- [ ] Upload a PNG/JPEG/WebP ≤ 1 MB → stored under `gcc/organisers/{uid}` on
      Cloudinary, shown on `/organiser/settings` and `/organisers/{uid}`.
- [ ] A non-image file, a renamed executable or an oversized file → rejected
      with a clear message; nothing is stored.
- [ ] Remove the logo → the Cloudinary asset is destroyed and both pages show
      the monogram fallback.
- [ ] Before the profile document exists, uploading → `409` (create the
      profile first).
- [ ] More than 5 logo changes in an hour → `429`.
- [ ] Cross-origin and unauthenticated attempts → `403`/`401`.

## 5. Dashboard

- [ ] Status cards show real counts per tournament status for the signed-in
      organiser only (another organiser's competitions never appear).
- [ ] "Active tournament slots: X of N" counts `registration_open` through
      `knockout` competitions; drafts, suspended, completed, archived and
      cancelled ones do not occupy slots.
- [ ] With slots exhausted (N reached), the create CTA is disabled and
      explains why; as the Super Admin the exemption notice replaces it.
- [ ] Attention items appear for: registration closing within 48 hours, a
      full field still open, a full field not yet confirmed, and suspended
      competitions — each linking to the workspace.
- [ ] Total registrations is the sum of `registrationCount` across the
      organiser's competitions.
- [ ] Recent audit shows the organiser's own privileged actions, newest first;
      with none, the honest empty state renders.
- [ ] With no tournaments at all, every panel shows honest empty states — no
      zeroed charts or invented rows.

## 6. Owned-tournament list

- [ ] `/organiser/tournaments` lists the organiser's own competitions newest
      by `updatedAt`, paginated 20 at a time with cursor Next/Previous.
- [ ] Name prefix search matches from the start of the name; combining it
      with the status filter works; Clear returns the full list.
- [ ] The status filter covers every status including `cancelled`.
- [ ] Primary actions match state: draft → "Continue setup" style link,
      registration open → "Manage registrations", suspended → "Review", and
      so on; there is no create/edit/publish control (Phase 8).
- [ ] As the Super Admin, the "All tournaments" scope toggle lists every
      competition on the platform; as an organiser the scope parameter is
      ignored server-side.
- [ ] Another organiser's competitions never appear in the default scope.

## 7. Tournament workspace

- [ ] `/organiser/tournaments/{id}` for an owned competition renders the
      header (name, status badge, entrant count) and the seven-step lifecycle
      stepper reflecting the real status.
- [ ] For a `completed` or `archived` competition, every step is done and no
      step is current; for `cancelled`, setup is done and the rest are locked,
      with the honest cancelled explanation.
- [ ] For a `suspended` competition, only Overview and Settings tabs are
      available; the others explain what unlocks them.
- [ ] Tab notices state the real condition ("Available after registration
      closes") — never a fake date or mock content.
- [ ] A **second organiser** opening the same URL → the branded 404 page,
      identical to the one for a non-existent id (no 403, no leak).
- [ ] A plain participant opening the URL → the same branded 404.
- [ ] The Super Admin opens the workspace from
      `/super-admin/tournaments` ("Open in organiser workspace") → renders.
- [ ] Overview shows the real next-step checklist for the current status and
      links into the available tab.
- [ ] Every tool tab (Registrations, Pots and draw, Fixtures, Results,
      Knockout, Result reports, Announcements, Graphics, Settings) renders its
      honest "not available yet" notice with no mock tables or controls.
- [ ] Registrations stays available for a cancelled competition (entrants
      keep their records); the page says so.

## 8. Public organiser page

- [ ] `/organisers/{uid}` lists the organiser's publicly visible competitions
      (published statuses and `cancelled`; drafts and suspended never) in the
      "Recent competitions" grid, 9 per page.
- [ ] "Show older" pages forward only; "Back to latest competitions" returns
      to page one; there is no crafted-cursor URL that skips ahead.
- [ ] A cancelled competition appears with its cancelled badge and a link to
      its public detail page, which still lists its registrations.
- [ ] With no public competitions, the page shows the honest empty state.
- [ ] Tournament cards, the register page and the tournament detail page all
      attribute the organiser consistently.

## 9. Rules, indexes and deployment

- [ ] `npm run test:rules` passes (organiser profile public reads and
      cancelled-tournament visibility included; write matrix covers
      `organiserProfiles` and `tournaments`).
- [ ] `npm run test:integration` passes (workspace guard matrix, dashboard
      counting, list filters, public page paging, profile bootstrap and the
      profile endpoint).
- [ ] `npm run rules:deploy` finishes with the new `tournaments` owner-scope
      indexes enabled and no index errors.
- [ ] No client Firestore write path exists anywhere in the flow.

## 10. Automated checks and Lighthouse

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:integration
npm run build
npm run format:check
```

Lighthouse (production build, local server, mobile preset): `/organisers/{uid}`
with a seeded organiser profile, and `/organiser` **signed in** (the dashboard
redirects unauthenticated visitors to `/login`, so an anonymous run would only
measure the login page). Record the four category scores and note that local
Lighthouse results vary by machine.
