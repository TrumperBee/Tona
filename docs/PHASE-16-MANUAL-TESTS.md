# Phase 16 manual acceptance script — notifications and email

This script proves the notification service, Resend delivery, preferences,
unsubscribe, bounce handling, change-email flow and Super Admin email tools on a
real deployment. Run it against a **production build** (`npm run build`, then
`npm start`) with a verified Resend sender and a public HTTPS URL for the
webhook. Use addresses you control.

## 0. Preparation and Resend configuration

- [ ] In Resend, add the sending domain and publish the SPF and DKIM records it
      shows. Wait until the domain is **Verified**.
- [ ] Set `RESEND_FROM` to an address on that domain, for example
      `GCC <no-reply@yourdomain.com>`. A free `onboarding@resend.dev` sender can
      only deliver to the account owner.
- [ ] Create a Resend API key and set `RESEND_API_KEY`.
- [ ] Generate a long random value for `EMAIL_UNSUBSCRIBE_SECRET`.
- [ ] Add a webhook pointing at `https://your-site/api/webhooks/resend` for
      `email.bounced` and `email.complained`. Copy its signing secret
      (`whsec_…`) to `RESEND_WEBHOOK_SECRET`.
- [ ] Keep `EMAIL_DAILY_LIMIT` low for the quota test (for example `5`) and
      `EMAIL_MONTHLY_LIMIT` at the plan figure (3000 on the free tier). Restart
      the app after changing environment values.
- [ ] Use **Send test email** on `/super-admin/email`. Confirm it arrives at the
      signed-in Super Admin's own address, with the GCC layout, a working
      preferences link and no unsubscribe link (critical/transactional).
- [ ] Open `/dev/email-preview` in development: every template renders. Confirm
      the route returns **404** in the production build.

## 1. Welcome email

- [ ] Register a new player with an address you control.
- [ ] The account is created even if Resend is unreachable (stop the key
      temporarily to prove it). A welcome email arrives once when email is
      configured.
- [ ] The email has one button, the GCC logo, a footer and no unsubscribe link
      (the welcome message is transactional).

## 2. Critical mail ignores preferences

- [ ] On `/dashboard/notifications/settings`, turn off every toggle. Save.
- [ ] As Super Admin, suspend the player's account with a reason.
- [ ] The player receives the suspension email anyway. The in-app notification is
      present. No unsubscribe link appears in the email.
- [ ] Restore the account and confirm the restore email also arrives.

## 3. Important mail and preferences

- [ ] As an organiser, confirm a player's entry in a published tournament.
- [ ] The player receives **Your entry is confirmed** by default.
- [ ] Turn off **Important competition emails** for that player and repeat with a
      second registration or a draw. No important email arrives; the in-app
      notification still does.
- [ ] Re-enable it.
- [ ] Complete a draw. Each player receives one pot email.
- [ ] Publish fixtures. Each player receives **ONE** email listing all eight
      fixtures, not eight emails.
- [ ] Trigger knockout qualification and the next-tie-ready notice. Each player
      receives at most one email per event.

## 4. Optional mail is opt-in

- [ ] With **Announcement emails** off, record a result and publish a tournament
      announcement. The player gets in-app notifications only.
- [ ] Turn **Announcement emails** on. Publish another announcement. One email
      arrives.
- [ ] Turn **Result emails** on and record a result. One result email arrives.

## 5. Unsubscribe

- [ ] Open a non-critical email and inspect its headers (or use a mail client's
      "unsubscribe" action): `List-Unsubscribe` and
      `List-Unsubscribe-Post: List-Unsubscribe=One-Click` are present.
- [ ] Click the footer unsubscribe link. The page shows a confirmation and the
      stream that would change. **Opening the page alone changes nothing** —
      reload it twice and confirm the preference is still on.
- [ ] Press **Confirm unsubscribe**. Only that stream is turned off in settings.
      The other streams and critical mail are unaffected.
- [ ] Replace the `t` query value with a random string: the page reports an
      invalid or expired link and offers the settings page.
- [ ] POST the same forged token to `/api/unsubscribe`: **400**, no change.
- [ ] Submit more than ten unsubscribe requests in a minute from one IP: **429**
      with `Retry-After`.

## 6. Bounce and complaint suppression

- [ ] Send to a known hard-bounce address (or use Resend's test event in the
      dashboard). Resend posts `email.bounced`; confirm the webhook returns 200.
- [ ] The dashboard shows the deliverability banner and the settings page
      explains that email is paused.
- [ ] Trigger a critical notification. The in-app record is written and **no**
      email is attempted.
- [ ] In Firestore, confirm `emailSuppressions/{sha256}` holds only a hash and a
      reason, and `users/{uid}.emailDeliverable` is `false`.
- [ ] Send a forged webhook (wrong signature or a timestamp older than five
      minutes): **401**, no suppression is written.
- [ ] Send a transient bounce: the webhook returns `handled:false` and the
      address stays deliverable.

## 7. Change email

- [ ] As a player, open `/dashboard/notifications/settings`. The current address
      is masked.
- [ ] Change to an address already used by another account: a clear inline error
      and no change.
- [ ] Change to a new address. Success reports that every session was signed out.
- [ ] The old address receives **Your GCC email address was changed**.
- [ ] Sign in with the old address fails; sign in with the new address works.
- [ ] The account is no longer signed in after the change (session cleared), and
      the dashboard banner is gone.
- [ ] Attempt four changes in one day: the fourth is **429**.
- [ ] Attempt a change with a session older than ten minutes (sign in, wait, or
      manipulate the cookie): **401** with a request to sign in again.
- [ ] As the pinned Super Admin, try to change email: **403** with the
      explanation that `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_UID` must be updated
      together.

## 8. Quota

- [ ] Set `EMAIL_DAILY_LIMIT=5` and restart. Normal mail stops after 4 sends
      (80%). Critical mail still sends until 5.
- [ ] Confirm every skipped or failed attempt still produced the in-app
      notification.
- [ ] On `/super-admin/email`, the daily card shows sent/limit, skipped and
      failed, and the warning appears at 80%. With `EMAIL_MONTHLY_LIMIT=5`, the
      monthly warning appears at 4.
- [ ] Force a Resend failure (temporarily break `RESEND_FROM` or revoke the key).
      The triggering action still succeeds; the failure appears in **Recent
      failures**, with no address or body.
- [ ] Confirm the caller never receives an email error from a normal action.

## 9. Announcement broadcast

- [ ] On `/super-admin/email`, the card shows how many opted-in users would
      receive the next announcement and how many normal sends remain today.
- [ ] With the switch off, publish a platform announcement: in-app only, no
      email.
- [ ] Turn the switch on and publish: opted-in active users receive one email
      each; opted-out users only get the in-app record.
- [ ] Set the daily budget so it cannot cover the audience (or lower the daily
      limit). Publishing is refused with a clear quota message and **no** user
      receives a partial email.
- [ ] With the monthly reference already reached, enabling the switch is refused
      and a publish does not send.

## 10. Notification centre

- [ ] `/dashboard/notifications` groups items under **Today**, **Yesterday** and
      dated headings.
- [ ] Each type shows an icon; unread rows are visibly marked.
- [ ] **Open** navigates to the correct same-origin page and marks the item read.
- [ ] **Mark all as read** clears the unread state and the header badge count.
- [ ] With no notifications the empty state is clean and links to settings.
- [ ] On a phone, the list, buttons and badge remain usable with no horizontal
      scrolling.

## 11. Regression and data check

- [ ] Registration, profile edit, organiser workspace, result entry, result
      reports, knockout and standings still work with email configured and with
      email deliberately broken.
- [ ] No rendered email contains a phone number, an API key, a webhook secret or
      an unsubscribe secret. Search the HTML and plain text for `+` followed by
      digits and for `whsec_`.
- [ ] `emailUsage`, `emailSuppressions` and `emailFailures` cannot be read from
      the client SDK (permission denied), even as Super Admin.
- [ ] `users.notificationPrefs` cannot be written from the client; only the
      settings endpoint changes it.
- [ ] Audit log contains `user.email.changed`, `email.test.sent` and
      `platform.email_announcements.set` entries with no address in the payload
      beyond the before/after email change record.
