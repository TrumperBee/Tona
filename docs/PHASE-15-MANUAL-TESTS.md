# GCC — Phase 15 manual test script

Phase 15 adds branded graphics generated from real tournament and player data. Every
template is a React component rendered in the browser and captured to a PNG; no external
graphics API and no sample data are involved.

## 0. Before testing

1. Use a tournament that has reached at least `pots_confirmed`. A completed tournament
   exercises every template, including the champion card and the knockout bracket.
2. Sign in as the organiser of that tournament for the gallery checks, and as the player
   for the profile card checks.
3. Have at least one player with a real Cloudinary avatar, one without an avatar and one
   whose avatar URL is unreachable (for example a deleted Cloudinary asset).
4. Test on the devices below. Desktop Chrome plus one real phone is the minimum; Safari
   must be tested on a real iPhone or iPad because the export double-render path exists
   only there.

## 1. Public tournament page

1. Open the tournament page and confirm the Pots, Fixtures, Results, Table and Knockout
   tabs each show a **Download image** control only when their data exists.
2. League table: open the dialog. Confirm all 36 rows are present, the band legend is
   visible, and the final/provisional label matches the stored table.
3. Pots: open the dialog. Confirm four pots of nine and every gamer tag appears once.
4. Fixtures: open matchday 1 and matchday 8. Confirm each graphic contains only that
   matchday, with home and away in the right order.
5. Results: open each completed matchday. Confirm scores match the public results and a
   0–0 result renders as a score, not as "vs".
6. Knockout: open the bracket graphic. Confirm the round columns, penalties and the
   champion strip match the bracket page.
7. Champion: from the tournament overview champion card, generate the champion graphic.
8. Download each image and confirm the file name looks like
   `gcc-{slug}-{template}-{hash}.png`.

## 2. Organiser gallery

1. Open **Organiser → tournament → Graphics**.
2. Confirm the gallery lists only graphics whose data exists. On a tournament that has
   not reached the pots stage, the honest "no graphic is available yet" notice appears.
3. Confirm every card shows a scaled preview and a **Preview & download** control.
4. Confirm an announcement poster appears only while registration is open, and its QR
   scans to the tournament page.
5. Open the same template twice with unchanged data and confirm the download name is
   identical.

## 3. Hall of Fame and profiles

1. Open a Hall of Fame detail page and generate the champion graphic. It must use the
   stored champion, runner-up, final score and champion record.
2. Open **Dashboard → Profile** and choose **Share profile**. Confirm the card shows the
   player's real totals, preferred-game rating and QR.
3. Open a public player page and choose **Share profile**. Confirm the same fields and
   that the QR opens that public profile.
4. Open a player with fewer than five rated matches and confirm the card says **Unranked**
   and explains the threshold instead of showing a rank.

## 4. Images, tags and layout

1. Generate a graphic containing the player without an avatar. Confirm a clean initials
   badge appears, never a broken-image icon.
2. Generate a graphic containing a player whose avatar URL fails. Confirm initials appear
   after the image timeout and the export still completes.
3. Confirm a 16-character gamer tag fits and a deliberately long tag truncates with an
   ellipsis rather than overlapping the numbers.
4. Confirm no layout shift occurs while the dialog opens, while photos load, or after the
   size selector changes.
5. Confirm every graphic includes the GCC identity, tournament name, season and game, the
   footer tagline and the domain.

## 5. Export behaviour

| Device / browser | Preview | Download PNG | Share to WhatsApp / X | Notes                                    |
| ---------------- | ------- | ------------ | --------------------- | ---------------------------------------- |
| Windows Chrome   |         |              |                       | 2× PNG, correct dimensions               |
| Windows Edge     |         |              |                       | Share may download instead               |
| Android Chrome   |         |              |                       | Web Share with image file                |
| iPhone Safari    |         |              |                       | Double-render path; no blank first frame |
| iPad Safari      |         |              |                       | Same as iPhone                           |
| macOS Safari     |         |              |                       | Fonts embedded correctly                 |
| Firefox desktop  |         |              |                       | Share falls back to download             |

Checks for every row:

1. The PNG is exactly 2160 × 3840 (story), 2160 × 2700 (portrait) or 2160 × 2160
   (square).
2. Text is sharp, webfonts are embedded and no text is clipped.
3. The exported image matches the preview, including avatars and the QR code.
4. Cancelling the share sheet does not download a file.
5. A slow connection still produces an image within a few seconds; a failed photo never
   blocks the export.

## 6. Regression checks

1. Generate graphics while signed out, then sign in and repeat. Public controls work
   without a session.
2. Confirm the organiser gallery is absent for a tournament owned by another organiser.
3. Confirm no graphic is generated for a private draft, an unpublished draw or a
   cancelled tournament surface that has no public data.
4. Confirm the existing public pages, match pages and workspace tabs still render and
   navigate normally after the graphics wiring.
