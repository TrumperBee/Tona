# Phase 13B-1 manual acceptance script - input focus and scroll

This script proves the two hotfixes on a real device. Run it against a **production
build** (`npm run build` then `npm start`) and once in `npm run dev`. The focus bug and
the scroll jump are both rendering defects, so a production build is the primary
evidence.

Record the browser, OS and viewport with each run. Emulated viewports are useful but do
not replace the phone run.

## 1. Typing keeps focus (Bug 1)

For each field: click the field, type `abcdefghijklmnopqrstuvwxy` (25 characters), then
confirm the cursor never disappeared, no character was lost, and the field still holds
the focus ring. Do not click between characters.

- [ ] `/login` - email, password.
- [ ] `/register` - full name, email, confirm email, password, confirm password, gamer
      tag (caps at 16 characters by design; the cursor must stay put after the cap).
- [ ] `/forgot-password` - email.
- [ ] `/players` - player search box.
- [ ] `/dashboard/profile/edit` - full name, community, favourite club, WhatsApp.
- [ ] Organiser workspace - tournament settings title/description, player search in
      results entry, the leg selector on the knockout board, the matchday window inputs
      on the fixtures board.
- [ ] Super admin - announcement title/body, platform settings message.

The same check on a phone in both portrait and landscape, with the on-screen keyboard
open. Rotating the device must not lose the cursor either.

## 2. Saving does not jump (Bug 2)

Set the page so the control you are about to use is halfway down a long page, note the
visible heading, then save. The page must not scroll and the control (or the next
logical control) must keep focus.

- [ ] Results - enter one result from the player panel and confirm the row updates in
      place, the inline "Result recorded." notice appears and a toast confirms it.
- [ ] Results - enter three results in a row without scrolling back up. After the third,
      the page is still where it was and the third row is marked complete.
- [ ] Results - matchday grid, enter several scores, save the batch; the grid clears and
      the rows show their results without moving the page.
- [ ] Results - correct a result with a reason; the corrected score shows in place.
- [ ] Results - clear a result; the row returns to "Not played" in place.
- [ ] Pots - move a player between pots and confirm the draw; the board stays in place.
- [ ] Registrations - confirm or withdraw an entry; the row updates without moving.
- [ ] Fixtures - generate, publish, edit a matchday window, verify, reset.
- [ ] Knockout - draw, publish and reset a round; record a leg score and a decider.
- [ ] Announcements - create, publish, unpublish, delete; the list updates in place.
- [ ] Settings - save tournament settings, platform settings, organiser profile and
      player profile; the inline "Saved" confirmation appears.
- [ ] Notifications - mark one read, then mark all read; the list updates in place.

## 3. Known-good behaviour

- Signing out and deleting a tournament navigate to a different page; those legitimately
  start at the top.
- Navigate away and back normally; no route should preserve a stale scroll position.
