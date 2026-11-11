# Phase 8 manual acceptance script — tournament creation and registration

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

The Super Admin is the account whose email matches `SUPER_ADMIN_EMAIL` in
`.env.local` (`owner@example.com` in the integration setup). Create it, verify
its email and sign in once so the claim and session cookie are issued.

You also need:

- One **organiser** account approved through the Phase 6 flow, with an
  `organiserProfiles/{uid}` document. Use a second organiser for the ownership
  checks.
- Three **participant** accounts with verified emails. Give each a country,
  platform and WhatsApp number so the entry restrictions can be exercised.

### Option B — real Firebase project

1. Copy the real `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_*` values into
   `.env.local`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
2. Confirm `localhost` is an authorised Auth domain.
3. Create the accounts above the same way.

No seeding is needed: this phase creates real tournament documents through the
wizard. `platformSettings/main` should be absent or use
`maxActiveTournamentsPerOrganiser: 3`.

## 1. Wizard and drafts

1. Sign in as the organiser and open `/organiser/tournaments/new`.
2. Confirm the format is shown as **UCL League Phase — 36** and cannot be
   changed. Confirm capacity is **36** and cannot be changed.
3. Save step 1 with a name, season, game and description. The draft appears in
   `/organiser/tournaments` with a working public-slug preview.
4. Open the settings page and complete rules, timezone, dates (registration
   opens, closes, start) and a cover image. Confirm the date order is enforced
   and a start more than 18 months away is rejected.
5. Try to publish with rules missing: the API returns field errors and nothing
   is published.
6. Publish a complete draft. Confirm the status becomes `registration_open` and
   the event appears in `/tournaments`.

## 2. Discovery and direct links

1. Open `/tournaments`. Confirm the published event is listed with its cover,
   name, season, dates and registration state.
2. Filter/search by game and name; paginate forward.
3. Open `/tournaments/[slug]`. Confirm the public facts and the register CTA.
4. While a second event is still `draft`, confirm it does not appear in
   discovery and its slug returns the not-found/notice page.
5. Suspend a published event as Super Admin and confirm it disappears from
   discovery; unsuspend and confirm it returns.

## 3. Registration, capacity and withdrawal

1. As participant A open the register page while entries are open. Enter and
   confirm the count becomes 1 and the membership appears under
   `/dashboard/tournaments`.
2. As the same participant try to register again: the API returns a contract
   error and the count stays 1.
3. Try a participant whose platform or country is outside the restrictions:
   the server rejects the entry with a clear field error.
4. Move the close date into the past (organiser settings) and confirm the
   server rejects a new entry; move it back.
5. Close registration, confirm the public page says closed and the register
   button is disabled. Reopen it and confirm both work again.
6. Withdraw as participant A. Confirm the count returns to 0 and the public
   participant list no longer shows them.
7. Capacity: run the integration evidence (`npm run test:integration`) for the
   40-simultaneous-entry case. Manually, fill all 36 slots (or register the
   remaining accounts) and confirm the state becomes **full**, a 37th entry is
   rejected and no count exceeds 36.

## 4. Organiser registrations manager

1. Open `/organiser/tournaments/[id]/registrations`. Confirm the participant
   list shows tags, countries, statuses and the exact count.
2. Search by gamer tag and filter by status; page through.
3. Remove a participant with a reason. Confirm the registration becomes
   `removed`, the count drops and the reason is audited.
4. Add a participant by gamer tag. Confirm duplicates and capacity are
   rejected.
5. Open the contact link for a participant with a WhatsApp number: the owner
   gets a `wa.me` link. A bystander or another organiser gets 404/403. A player
   without a number gets a clear 409.
6. Export the CSV. Confirm it contains only public snapshot fields (no email or
   phone). A second organiser cannot export.

## 5. Lifecycle and cancellation

1. As the owner, close registration and confirm the stepper advances.
2. Try an illegal transition (for example reopen a `completed` event): the
   server rejects it.
3. Cancel an event with a reason. Confirm:
   - the public pages no longer list it;
   - a direct `/tournaments/[slug]` link shows the honest cancellation notice
     (not another organiser's data);
   - the organiser workspace and Super Admin still see it;
   - a member who was registered can no longer re-register or withdraw into an
     open state.
4. Confirm the cancellation reason appears in the audit trail.

## 6. Super Admin actions

1. Sign in as the Super Admin and open `/super-admin/tournaments`.
2. Suspend a running event with a reason. Confirm it disappears from public
   discovery and the owner sees the suspended state; resume it and confirm the
   public listing returns.
3. Cancel an event from the console with a reason; confirm the same cancelled
   behaviour as §5.
4. Transfer ownership to the second organiser. Confirm the first organiser
   loses access (404) and the second gains the workspace, while registrations
   and public pages are unchanged.
5. Confirm every action wrote an audit entry with actor, target and reason.

## 7. Access control spot checks

1. A participant cannot open `/organiser/tournaments/new` or call the organiser
   API (403/redirect).
2. Organiser B cannot open or mutate organiser A's tournament (404), export its
   registrations, or read its contact links.
3. A suspended/banned account cannot register; the session route rejects it.
4. An unverified account cannot register for a tournament in this phase.
5. During maintenance mode, non-Super-Admin tournament mutations are blocked
   with the maintenance message; the Super Admin can still act.

## 8. Evidence

Record: environment, account ids, tournament ids, the counts observed at each
step, and any screenshot or log excerpt. A phase is accepted only when every
step passes on the recorded environment.
