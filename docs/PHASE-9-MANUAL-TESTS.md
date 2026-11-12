# Phase 9 manual acceptance script — pot allocation

Run this script against **either** a local emulator stack or a real Firebase
project. Record which environment you used; the two are not interchangeable
evidence. Never seed fake players into the production project: use the emulator
for the 36-player field.

## 0. Environment and prerequisites

### Option A — local emulators (recommended)

```bash
# Terminal 1
npm run emulators

# Terminal 2 — point the app at the emulators
npm run dev
```

Sign in as an **organiser** account with an `organiserProfiles/{uid}` document.
The Super Admin is the account whose email and uid match `SUPER_ADMIN_EMAIL` and
`SUPER_ADMIN_UID`. A plain participant account is needed for the access checks.

To exercise the draw you need one tournament in `registration_closed` with
exactly 36 `registered` players and a matching `registrationCount: 36`. On the
emulator, create the accounts through the Auth emulator and seed the
registrations directly (the integration suite does exactly this in
`tests/integration/draw.test.ts`). Do not add fake players to a real project.

### Option B — real Firebase project

Use a real, organiser-controlled tournament with the real 36 registered players.
The draw only unlocks for an exactly full field, so a short or over-full field
cannot be exercised against production data. Verify that a short field shows the
exact count and no draw control.

### Evidence commands

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:rules
npm run test:integration
npm run format:check
```

## 1. Unlock gating

1. With registration **open**, open `/organiser/tournaments/[id]/pots`. Confirm
   the page explains that registration must close first and no shuffle or manual
   move is offered. The lifecycle stepper shows the same reason.
2. Close registration with fewer than 36 players. Confirm the pots step becomes
   locked and the page states the exact count (for example, “this competition
   has 31”). No draw is generated.
3. With exactly 36 registered players, confirm the board opens with an
   **Unassigned** column plus Pots 1–4, and every player appears exactly once.
4. As another organiser, open the same URL: confirm the branded 404. As a plain
   participant, confirm the organiser workspace redirects to `/dashboard`
   (never a broken page or another organiser's data).

## 2. Seeded shuffle and pins

1. Click **Shuffle the field**. Confirm:
   - four pots of exactly nine appear;
   - every pot count reads `9/9` and Unassigned reads `0`;
   - the transparency panel shows a 64-character hex seed and method
     “Seeded shuffle”;
   - the audit log contains `tournament.draw.shuffled` with actor, seed and
     algorithm version.
2. Note one player's pot. Pin that player, then shuffle again. Confirm the
   pinned player stays and the board reports “Shuffle unlocked”.
3. Unpin, shuffle again, and confirm the seed changes and the allocation is
   different (a different seed is expected to produce a different order).
4. Reload the page after a shuffle. Confirm the seed, pins and placements
   persist because they are stored server-side.
5. Try to tamper with the request (for example, send a client seed or a
   fabricated pot). Confirm the server ignores/rejects it; the client never
   supplies the seed.

## 3. Manual moves and validation

1. Click **Clear**. Confirm every player returns to Unassigned and all pins are
   released; the saved seed is discarded.
2. Move players with the **Move to…** select (keyboard only: Tab to the select,
   change the value with the keyboard). Confirm a pot accepts nine and rejects a
   tenth with “Pot N already holds nine players.”
3. Move a player back to Unassigned. Confirm the live counters update and the
   validation list names the remaining unassigned count.
4. Confirm **Confirm the draw** stays disabled until all four pots hold nine and
   Unassigned is empty.
5. Confirm the board is usable on a narrow mobile viewport: columns stack, the
   avatar chips truncate correctly and the controls remain reachable.

## 4. Confirmation

1. Complete the board and open the Confirm dialog. Confirm the dialog lists all
   four pots and their players.
2. Confirm. Verify:
   - the tournament moves to `pots_confirmed`;
   - the draw is now read-only (no shuffle, move, pin or clear controls);
   - the success panel shows the confirmation time, method and seed;
   - the audit log contains `tournament.draw.confirmed` with the operator;
   - all 36 players receive an in-app notification naming their pot.
3. Open `/tournaments/[slug]`. Confirm the **Pots** tab appears with four pots
   of nine, avatars, profile links, the method and the seed.
4. Open the same public page signed out. Confirm the Pots tab is public after
   confirmation. Before confirmation it must not appear at all.
5. Run the concurrency evidence: two simultaneous confirm requests must leave
   exactly one confirmed draw and one confirmation audit entry (covered by
   `npm run test:integration`).

## 5. Undo and replacement

1. Confirm the draw, then click **Undo confirmation** without a reason: the
   action stays disabled. Enter a 5–300 character reason and undo. Confirm the
   draw returns to draft, the tournament returns to `registration_closed`, the
   tiebreak seed is cleared, and the audit log records the reason.
2. Re-confirm. Create a fixture draft (or any match) for the tournament, then
   try Undo again. Confirm it is refused with the fixture message; remove the
   fixture work and confirm Undo works again.
3. With no fixture work, open **Replace player**. Choose an outgoing registered
   player and search for an incoming active player. Confirm:
   - the incoming player takes the exact same pot slot;
   - the outgoing registration becomes `removed` and the incoming one
     `registered`;
   - the field stays at exactly 36 and the pot counts stay 9/9;
   - both players are notified and the reason is in the audit log;
   - a platform or country restriction still rejects an ineligible incoming
     player.
4. Confirm replacement is blocked once fixture work exists.

## 6. Public visibility

1. While the draw is a draft, open the public tournament page signed out:
   confirm there is no Pots tab, no pot data in the HTML, and no seed.
2. After confirmation, confirm the Pots tab is visible and each player links to
   their profile.
3. Cancel a confirmed tournament and confirm the Pots tab disappears again
   (cancelled competitions are not publicly readable, ADR-044). The owner still
   sees the draw in the workspace.
4. Confirm a draft draw document cannot be read by an anonymous client
   (rules test) and that a confirmed draw on a cancelled tournament is denied.

## 7. Transparency and accessibility

1. Confirm the organiser and public panels state the method (“Seeded shuffle”,
   “Manual placement” or “Seeded shuffle with pinned players”), the seed and
   the algorithm version where applicable.
2. Confirm every move control has a visible or screen-reader label that names
   the player and the target pot; the pin toggle exposes `aria-pressed`.
3. Confirm focus rings are visible on the select, pin, Shuffle, Clear and
   Confirm controls, and that dialogs trap focus and close with Escape.

## 8. Lighthouse (mobile)

With the emulator stack or a real organiser session, run Lighthouse in mobile
mode against `/organiser/tournaments/[id]/pots` (Chrome DevTools → Lighthouse →
Mobile → Performance, Accessibility, Best Practices, SEO). Record the four
scores and any failing audit. The page must not depend on client-side Firestore
reads; the board is rendered from server data and the actions call same-origin
route handlers.

## 9. Evidence

Record: environment, account ids, tournament id, the observed registered count
and pot counts, the shuffle seed, the confirmation time, Lighthouse scores, and
any screenshot or log excerpt. A phase is accepted only when every step passes
on the recorded environment.

## 10. Recorded local result (2026-11-12)

Production build (`npm run build` + `npm start`) against the Auth/Firestore
emulators, emulator-seeded 36-player tournament, Lighthouse 13 mobile preset:

| Category       | Score |
| -------------- | ----- |
| Performance    | 71    |
| Accessibility  | 100   |
| Best Practices | 100   |
| SEO            | 54    |

Lighthouse reported that the host CPU was slower than it expects, so
performance is a lower bound for this machine. SEO is intentionally low for an
authenticated organiser route: the page is `noindex` (correct for internal
tools) and has no public meta description. Re-run on the deployment target and
record the new numbers; local results vary by machine.
