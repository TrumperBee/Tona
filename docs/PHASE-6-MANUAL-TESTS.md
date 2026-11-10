# Phase 6 manual acceptance script — organiser applications and notifications

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

You also need at least one participant account with a **verified** email. Verify
the account by clicking the verification link Firebase emails (the Auth emulator
prints the links to its console output).

### Option B — real Firebase project

1. Copy the real `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_*` values into
   `.env.local`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
2. Confirm `localhost` is an authorised Auth domain.
3. Create a participant account and verify its email. Sign in once as the
   configured Super Admin.

Before testing, confirm no fake data exists. `adminApplications`,
`applicationState` and `users/{uid}/notifications` should contain only records
created below. Check `platformSettings/main` for the cooldown you want to test
with (default `applicationCooldownDays: 7`).

## 1. Organiser code page

- [ ] Signed out, open `/organiser-code` → it renders fully; no sign-in
      required.
- [ ] The page covers fair play, accurate results, players' privacy and contact
      details, respectful conduct, and the statement that GCC does not handle
      payment collection for tournaments.
- [ ] It explains what happens when the code is broken (warning, role removal,
      suspension) without promising enforcement GCC cannot do.
- [ ] The "Apply to organise" link opens `/dashboard/apply-admin`.

## 2. Application form access control

- [ ] Signed out, open `/dashboard/apply-admin` → redirected to `/login`.
- [ ] Signed in as an **unverified** participant → the page renders with the
      verification banner, the form is absent, and the note says the email must
      be verified first.
- [ ] Signed in as a verified participant (`user` role) → the form renders with
      all fields: community name, community type, community link, expected
      players, games planned (multi-select), experience, motivation and the
      rules agreement checkbox linking to `/organiser-code`.
- [ ] Signed in as an organiser → the page shows "You already hold an organiser
      role" and a link to the organiser workspace; no form.
- [ ] Signed in as the Super Admin → the page says Super Admin accounts cannot
      apply through the organiser flow; no form.
- [ ] Use a REST client to POST `/api/admin-applications` with no cookie →
      `401`; as an organiser → `403`; with a foreign `Origin` header → `403`;
      while maintenance mode is on as a participant → `503`.

## 3. Form validation (server-side)

Submit from the form, or with a REST client as the verified participant:

- [ ] Community name of 1 character, and of 61 → rejected with a field error.
- [ ] Community type not in the list (e.g. `"company"`) → rejected.
- [ ] `communityLink` set to `http://example.com` (not https) and to
      `javascript:alert(1)` → rejected; `https://chat.whatsapp.com/…` and empty
      → accepted.
- [ ] `expectedPlayers` not one of `under 36 | 36-72 | 73-150 | 150+` →
      rejected.
- [ ] `gamesPlanned: []` → rejected ("at least one game"). An unsupported game
      id → rejected. A duplicate game → rejected.
- [ ] `experience` and `motivation` shorter than 50 or longer than 1000
      characters → rejected.
- [ ] `agreesToRules` missing or `false` → rejected.
- [ ] A payload with an extra unknown field (e.g. `"status": "approved"`) →
      rejected by the strict schema; the client can never set status, reviewer
      fields or identity snapshots.

## 4. Submission behaviour

- [ ] Submit a complete, honest application → `201`, and
      `/dashboard/apply-admin` now shows the pending card with the submitted
      date and community name.
- [ ] Firestore `adminApplications/{id}` contains the submitted fields plus the
      snapshotted `gamerTag` and `email`, `status: "pending"`, null reviewer
      fields and server timestamps.
- [ ] `applicationState/{uid}` exists with `status: "pending"` and
      `currentApplicationId` pointing at the application.
- [ ] Submit again while pending → `409` ("You already have a pending
      application"). Only one pending document exists in Firestore.
- [ ] The Super Admin account received an in-app notification: the header bell
      shows an unread badge, and `/dashboard/notifications` (as the Super
      Admin) lists "New organiser application" linking to the application
      detail page.
- [ ] `auditLogs` contains an `application.submitted` entry with the community
      summary as the after payload.
- [ ] Submit more than 5 times within an hour (successful or failed) → `429`.

## 5. Super Admin review queue

- [ ] Signed in as a participant, open `/super-admin/applications` → redirected
      away; the queue never renders.
- [ ] As the Super Admin, the queue defaults to the **Pending** tab, oldest
      first (create several applications from different accounts and confirm
      the ordering).
- [ ] Tabs show real counts for Pending, Approved, Rejected, Withdrawn and
      Revoked. With none in a tab, the count is zero and the list shows an
      honest empty state.
- [ ] Rows show the applicant's avatar, gamer tag, community, expected players
      and submitted date.
- [ ] Pagination uses cursors: create more than 20 pending applications, walk
      Next/Previous, and confirm no rows repeat or vanish when a new
      application is submitted between requests.
- [ ] Open the detail page: all submitted fields appear (including the games,
      experience, motivation, the https link when present and the identity
      snapshot), plus the applicant profile summary (joined date, country,
      role, status, email-verified state) and any previous applications.

## 6. Withdrawal

- [ ] As the applicant with a pending application, press "Withdraw" and confirm
      → the card shows Withdrawn and the form returns.
- [ ] The application document reads `withdrawn` and
      `applicationState.status` is `"none"` with no current application.
- [ ] An `application.withdrawn` audit entry exists.
- [ ] Withdrawing a non-pending application (REST client, replay an old id) →
      `409`.
- [ ] Withdrawing someone else's application id → `404` (no information leak).
- [ ] A withdrawn application starts **no cooldown**: the applicant can submit a
      new application immediately.

## 7. Rejection and cooldown

- [ ] As the Super Admin, open a pending application and press Reject with a
      note shorter than 10 characters → the client blocks it; the server also
      rejects (`400`).
- [ ] Reject with a note of 10–300 characters → the queue updates; the row moves
      to the Rejected tab.
- [ ] The applicant's `/dashboard/apply-admin` shows "Not approved", the admin's
      note verbatim, and the reapply date computed from
      `applicationCooldownDays`.
- [ ] The applicant received a notification containing the note.
- [ ] Submitting again before the reapply date → `409` with the reapply date in
      the response, and the form is hidden with the reopen date shown.
- [ ] Change `applicationCooldownDays` to `0` in Super Admin settings → the
      applicant can reapply immediately (form returns).
- [ ] Restore the previous cooldown value afterwards.
- [ ] An `application.rejected` audit entry exists with the note as the reason.

## 8. Approval

- [ ] As the Super Admin, approve a pending application (optionally with a
      note) → the detail page confirms "Application approved and organiser role
      granted."
- [ ] The application reads `approved` with `reviewedBy`, `reviewedAt` and the
      note; `applicationState.status` is `"none"`.
- [ ] The applicant's custom claim is `organiser` (check the Auth console) and
      their refresh tokens were revoked.
- [ ] The applicant's `/dashboard/apply-admin` shows the approved card with next
      steps and a "Sign in again" link.
- [ ] The applicant received an approval notification.
- [ ] Re-approve the same application → succeeds as a no-op
      (`alreadyReviewed`), nothing changes in Firestore.
- [ ] Approve an application whose status is not pending (e.g. rejected) →
      `409`.
- [ ] Suspend the applicant, then approve their pending application → refused
      with the account-status conflict. Restore the account afterwards.
- [ ] Approve for an applicant with an unverified email → refused.
- [ ] As a participant or organiser, POST the approve and reject routes →
      `403`; with no cookie → `401`.
- [ ] An `application.approved` audit entry exists; the role change itself also
      logs `user.role.set`.

## 9. Approved applicant's session

- [ ] With the applicant still signed in from before the approval, open an
      organiser page (e.g. `/organiser`) → the server redirects to sign-in with
      the "Your permissions changed, please sign in again" notice
      (`?reason=permissions`).
- [ ] Sign in again → the participant lands in the organiser workspace.
- [ ] Visiting `/login?reason=permissions` directly shows the same fixed notice;
      changing the `reason` value to arbitrary text (`?reason=<script>`) shows no
      injected content — the message is a fixed mapping, not URL text.
- [ ] A rejected applicant who tries `/organiser` → redirected to `/dashboard`
      without the permissions notice.

## 10. Revocation history

- [ ] With an approved organiser, use the Phase 5 Super Admin action to revoke
      the organiser role with a reason.
- [ ] The organiser's latest approved application now reads `revoked` and
      appears in the Revoked tab.
- [ ] An `application.revoked` audit entry exists (in addition to
      `user.role.set`).
- [ ] The former organiser's `/dashboard/apply-admin` shows the revoked card with
      the reason, and the application form returns (revocation starts no
      cooldown).

## 11. Notifications

- [ ] `/dashboard/notifications` lists the account's own notifications newest
      first with type, title, body and relative/absolute date; unread rows are
      visually distinct.
- [ ] Notification links only navigate within the site (no external URLs).
- [ ] "Mark as read" on one notification → it loses the unread styling and the
      unread counter drops by one.
- [ ] "Mark all as read" → every row is read and the counter is zero.
- [ ] Pagination works with more than 20 notifications.
- [ ] Another account's notifications are not visible here; a REST client
      posting another user's notification ids to `/api/notifications/read`
      updates nothing (`updated: 0`) — ids are resolved under the caller's own
      path.
- [ ] More than 50 ids in one request → `400`.
- [ ] The header bell appears in the participant dashboard, the organiser
      workspace and the Super Admin console shells, with the correct unread
      count and the five newest notifications; opening a stale tab refreshes on
      reload.
- [ ] Signed out, the bell is absent and no per-request unread count query runs
      for anonymous pages.
- [ ] A client Firestore read of another user's `users/{uid}/notifications` is
      denied by rules; writes to any notification are denied.

## 12. Rules, indexes and deployment

- [ ] `npm run test:rules` passes (application reads, `applicationState`
      server-only and notification owner reads included).
- [ ] `npm run test:integration` passes (apply/duplicate/cooldown/approve/
      rollback/idempotency/403 matrix and notification ownership included).
- [ ] `npm run rules:deploy` finishes with the `adminApplications` indexes
      enabled and no index errors.
- [ ] No client Firestore write path exists anywhere in the flow.
