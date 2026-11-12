# GCC — Phase 11 manual test script

Phase 11 adds admin result entry, corrections, clears, player result reports,
public results and match pages, and player match history. Players never submit
a result.

## 0. Before testing

1. Deploy the new rules and indexes:

   ```bash
   npm run rules:deploy
   ```

   The new indexes are:

   - `matches` collection group: `participants CONTAINS + status ASC + updatedAt DESC`
   - `resultReports` collection: `status ASC + createdAt DESC`
   - `resultReports` collection group: `status ASC + createdAt DESC`

   Wait for the Firebase console to show all three as **Enabled**. Until then,
   filtered report pages and player match history can fail with a missing-index
   error.

2. Use a tournament whose fixtures are published (status `fixtures_published` or
   `league_phase`) and whose owner account is signed in. A Super Admin account
   can perform the same steps on any tournament.

3. Keep a second browser (or private window) signed in as one of the two players
   in a match.

## 1. Organiser result entry — find player

1. Open **Organiser → tournament → Results**. The page is available at
   `fixtures_published` and `league_phase`.
2. In **Find player**, type the first letters of a registered gamer tag. Only
   players registered in this tournament appear, filtered by tag prefix.
3. Select the player. Their eight fixtures appear with matchday, opponent and
   home/away; unplayed matches are listed first.
4. Pick a fixture. Enter a score such as `3 – 1` and press **Save result**.
5. Confirm the dialog repeats the score and the two player tags.
6. After saving:
   - the fixture shows `Completed`;
   - the organiser panel shows who entered it and when;
   - the tournament status becomes `league_phase`;
   - both players receive a notification titled
     `Result recorded: you vs <opponent>, 3-1` (scores are from the recipient's
     side).
7. Refresh the page. The score persists and `leagueMatchesCompleted` increased
   by one.

## 2. Double entry is refused

1. Reopen the same completed fixture.
2. The entry form is replaced by the recorded score and **Correct** / **Clear**.
3. If a stale tab still submits the fixture, the server returns 409 with a
   message telling the organiser to use **Correct**.

## 3. Organiser result entry — matchday grid

1. Open the **Matchday grid** tab and select matchday 1.
2. Enter scores for two or three unplayed fixtures and press **Save entered
   results**.
3. All entered results save in one request and all appear after refresh.
4. Make one fixture invalid (for example leave one score blank while the other
   has a value). The whole batch is refused and no fixture changes.
5. Try a batch containing one already-completed match. The whole batch is
   refused and the unplayed fixtures stay unplayed.

## 4. Correction

1. On a completed fixture choose **Correct**.
2. Change the score, then try to save with a reason shorter than 5 characters.
   It is refused.
3. Enter a real reason (5–300 characters) and save.
4. The score changes, the panel shows the correcting admin and time, and an
   `Edit` count appears.
5. In **Super Admin → Audit log**, filter to the tournament. The correction entry
   shows the previous score, the new score and the reason.
6. Both players receive a `Result corrected` notification.

## 5. Clear

1. On a completed fixture choose **Clear** and give a reason.
2. The fixture returns to `Scheduled` and the result disappears from the public
   page.
3. If it was the only completed result, the tournament returns to
   `fixtures_published`. The Results page remains available.
4. The audit log records `match.result_cleared` with the removed score and the
   reason.
5. Both players receive a `Result cleared` notification.

## 6. Public results and match page

1. Sign out. Open `/tournaments/<slug>`.
2. The **Results** tab appears once fixtures are published. Completed matches are
   grouped by matchday, newest matchday first. No unplayed score is invented.
3. The **Fixtures** tab shows the same scores and each fixture links to
   `/tournaments/<slug>/matches/<matchId>`.
4. Open a match page. It shows both avatars, names, matchday, status, score and
   the admin who recorded it. The back link returns to the tournament.
5. Share the URL in a private window: the page still opens and the page title
   contains the score and tournament name.
6. An unplayed match page shows `vs`, `Scheduled` and "The result has not been
   recorded yet."

## 7. Player report

1. Sign in as one of the two players. Open **Dashboard → My fixtures**.
2. A completed fixture shows **Report a problem**.
3. Open it, try fewer than 10 characters (refused), then send a real description
   (10–500 characters).
4. The button reports success. The organiser receives a notification and the
   report appears in **Organiser → tournament → Result reports** with status
   `open`.
5. Submit a second report from the same player for the same match. It is refused
   until the first is resolved.
6. As a third player who did not play the match, the route refuses with 403 (the
   button is only shown for the player's own completed fixtures).

## 8. Organiser report inbox

1. Open **Result reports**. Filter by `Open`, `Resolved`, `Dismissed` and page
   through the list.
2. Use **Open correction panel** on a report. It opens the Results page with that
   fixture selected. Make any score change there with its own reason.
3. Back on the report, choose **Resolve** or **Dismiss**. A note of 5–300
   characters is required.
4. The report leaves the `Open` filter, shows the admin note, and the reporter
   receives a notification with that note.
5. Every decision appears in the audit log.

## 9. Super Admin oversight

1. Sign in as Super Admin and open `/super-admin/result-reports`.
2. Reports from every tournament appear newest first. Filter and paginate.
3. Resolve or dismiss one. The tournament owner can still see the decision in
   their own inbox.
4. Open `/organiser/tournaments/<id>/results` for a tournament you do not own.
   The Super Admin can record, correct and clear results there.

## 10. Player match history

1. Sign in as a player with recorded results. Open **Dashboard → Profile**.
2. **Match history** lists completed matches newest recorded first, ten per page.
3. Each row shows the tournament, matchday, opponent, score and a `Win`, `Draw`
   or `Loss` chip from the player's perspective.
4. Page forward and back. New results do not duplicate or skip rows.
5. The **Competitive record** numbers are unchanged by Phase 11; history is a
   separate list.
6. A player with no results sees the honest empty state.

## 11. Access checks

1. A plain player cannot open the organiser results page or call the result
   routes (403 from the organiser guard).
2. Another organiser cannot read or mutate this tournament's results or reports
   (404, the same as a missing tournament).
3. Results cannot be entered before fixtures are published (409).
4. Non-league stages are refused in Phase 11 (409) even if a document exists.
5. A cross-origin POST to any result or report route is rejected (403).

## 12. Automated verification

Run all of the following before accepting the phase:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:integration
npm run format:check
npm run build
```

Lighthouse mobile on a published tournament page with the Results tab should
stay at the project's accessibility and performance thresholds.

## 13. Recorded local result (2026-11-12)

Production build (`npm run build` + `npm start`) against the Auth/Firestore
emulators, an emulator-seeded published 36-player league phase with completed
results, Lighthouse 13.6 mobile preset. Audited URL:
`/tournaments/lighthouse-cup` (the page renders the Overview, Pots-less,
Fixtures and Results tabs; the Results data is loaded on the server).

| Category       | Score |
| -------------- | ----- |
| Performance    | 70    |
| Accessibility  | 100   |
| Best Practices | 100   |
| SEO            | 91    |

The run found and fixed two pre-existing accessibility defects on the public
tournament overview: the competition facts used an invalid nested `<dl>`
structure, and the first card heading skipped from `h1` to `h3`. After the fix
the accessibility category reports no failing audits.

Lighthouse reported that the host CPU was slower than it expects (TBT around
3 s), so performance is a lower bound for this machine. The single SEO failure
is `meta-description`: Next.js 16 streams the `<meta name="description">` tag
after `</head>` in the raw response, so the audit misses it even though the tag
is present in the document and the page has a real description. Re-run on the
deployment target and record the new numbers; local results vary by machine.
