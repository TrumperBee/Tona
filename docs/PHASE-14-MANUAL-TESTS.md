# Phase 14 manual acceptance script — WhatsApp contact

This script proves the player-to-opponent and organiser contact flows on real
devices. Run it against a **production build** (`npm run build`, then `npm start`)
with a seeded tournament, and repeat the WhatsApp steps on:

- **Android** (Chrome → WhatsApp app installed).
- **Desktop** (Chrome or Edge → WhatsApp Web signed in, or the desktop app).

Record the device, OS, browser and whether the WhatsApp app or Web opened.

## 0. Preparation

Create real data through the UI, not scripts:

- [ ] Two player accounts (**A** and **B**) with active status and a valid
      WhatsApp number on each profile. Use numbers you control.
- [ ] An organiser account owning a tournament with at least one published
      fixture between A and B that has **no result**.
- [ ] A third account (**C**) that is not in that match.
- [ ] In the organiser workspace, open **Settings** and set the WhatsApp contact
      note to `Please agree a time before Sunday`. Save.
- [ ] Sign out of everything, then sign in as **A**.

## 1. Button visibility (player)

- [ ] `/dashboard/fixtures` shows **Contact on WhatsApp** on the scheduled match
      against B, and does **not** show it on any completed match.
- [ ] The public tournament page's **My matches** row shows the same button for A
      only. Signed out (or as C), the button is absent everywhere.
- [ ] Open the public match page for the fixture as A: the button appears in the
      header. As C: it does not.
- [ ] The page never prints a phone number anywhere: search the rendered text for
      `+` followed by digits.

## 2. Preview, edit, send (Android)

- [ ] Tap **Contact on WhatsApp**. The bottom sheet opens and shows
      _Preparing your message…_, then the suggested text.
- [ ] The preview contains A's tag, B's tag, the tournament name, `Matchday N`
      (or the knockout round) and the organiser note on its own paragraph.
- [ ] Edit the text. The counter updates and stops at `500 / 500`.
- [ ] Clear the text and tap **Open WhatsApp**: an inline error appears and no tab
      opens.
- [ ] Restore a message and tap **Open WhatsApp**. WhatsApp opens in a new tab
      (Android: the app) with the edited text pre-filled.
- [ ] **Press Send yourself.** Confirm the sheet said the message opens in
      WhatsApp and that the player must press Send.
- [ ] Return to GCC: the sheet is closed and the page is unchanged.
- [ ] Long-press the WhatsApp message input before sending: it contains the text
      but the GCC UI never displayed a number.

## 3. Preview, edit, send (desktop)

- [ ] Repeat section 2 in a desktop browser with WhatsApp Web signed in.
- [ ] With a popup blocker active, **Open WhatsApp** still opens exactly one tab.
      If the request fails, no orphan blank tab is left behind.

## 4. Negatives

- [ ] Sign in as **C** and open the public match page: no contact action.
- [ ] Sign out and open the same page: no contact action.
- [ ] Suspend **B** in the Super Admin console. As A, open the sheet: it shows
      **Contact unavailable** with a neutral reason and no **Open WhatsApp**
      button. Unsuspend B afterwards.
- [ ] Remove B's WhatsApp number from B's profile. As A, the sheet shows
      **Contact unavailable**; the message does not reveal the cause.
- [ ] Record a result for the fixture. As A, the button disappears from the
      dashboard, fixtures panel and match page.
- [ ] Create or find a knockout tie whose second side is not decided. As the known
      player, the endpoint refuses contact (409) and the UI shows a neutral
      unavailable state.
- [ ] Impersonate another signed-in account and call the POST route with a match
      they do not participate in (DevTools). It returns **403** and no
      `contactEvents` document is written.

## 5. Rate limit

- [ ] With DevTools open, issue 30 contact links for the same match as A
      (Script snippet or repeated clicks). The 31st returns **429** with a
      `Retry-After` header and the sheet shows a friendly error.
- [ ] Clear the rate-limit collection in the emulator (or wait an hour) and
      confirm the flow works again.

## 6. Organiser contact (Phase 8 route, updated copy)

- [ ] As the owner, open the tournament **Registrations** tab. Each registered
      player has a compact **Contact** action.
- [ ] Tap Contact for A: WhatsApp opens with the generic organiser message plus
      the contact note. Press Send yourself.
- [ ] As another organiser, the same route returns **404**. As a plain player,
      **403**.
- [ ] The organiser UI never prints the number; only WhatsApp shows it.
- [ ] In the Super Admin audit viewer, the issuance appears as
      **Registration contact link issued** and contains no number.

## 7. Super Admin visibility

- [ ] As Super Admin, open A's user detail. **WhatsApp contact activity** lists
      the issuances where A was the sender or recipient.
- [ ] Each row shows direction, match id, tournament id, template (or
      _Player-edited message_) and time. No message text and no number appear.
- [ ] An edited message shows **Player-edited message**, an unedited one shows the
      template id.

## 8. Copy and consent

- [ ] `/terms` has the **WhatsApp contact with opponents** section.
- [ ] `/privacy` explains that a WhatsApp link necessarily contains the number,
      that it is never displayed as text, and that removal stops new links.
- [ ] The registration form's consent links Terms and Privacy and mentions that
      the other player in a match can contact the player on WhatsApp.

## 9. Regression

- [ ] Player dashboard, `/dashboard/fixtures`, `/dashboard/tournaments`,
      `/dashboard/profile`, the public tournament page and the match page all
      render with real data and no console errors.
- [ ] The organiser workspace tabs (fixtures, results, knockout, standings,
      registrations, settings) still load.
- [ ] The Super Admin user detail page still loads, including the new contact card
      for a user with no issuances (honest empty state).

## 10. Data check

- [ ] In the Firestore emulator (or the console), confirm a `contactEvents`
      document contains exactly `tournamentId`, `matchId`, `fromUid`, `toUid`,
      `templateId` and `createdAt` — no phone number and no message body.
- [ ] Confirm no document in `publicProfiles`, `tournaments` (and subcollections),
      `announcements`, `hallOfFame` or `rankings` contains an E.164 number written
      by the flow.
