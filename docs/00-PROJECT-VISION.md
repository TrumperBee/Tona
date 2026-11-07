# GCC — Project Vision

**Global Champions Circuit (GCC)**
**One Platform. Endless Competition.**

> Status: Phase 1 — foundation and scaffold. This document describes the product the
> platform is being built to become; the current codebase contains structure and
> documentation only.

## 1. What GCC is

GCC is an independent, web-based tournament management platform for football gaming
communities. It is designed for players and organisers who compete in titles such as
eFootball, EA SPORTS FC and Dream League Soccer, and for the communities that run
competitions around those games.

GCC is **not** a game, a publisher service, a betting product or a league operated by a
football governing body. It is neutral infrastructure for community competition: a place
to register players, draw pots, generate fixtures, verify results, calculate standings,
run knockouts and preserve the record of every season.

### Independence and branding

GCC is not affiliated with, endorsed by or sponsored by UEFA, any football game publisher
or any professional league. It never uses UEFA logos, competition marks or protected
branding. The launch format is inspired by the modern 36-team league phase because that
format is a strong competitive structure — not because GCC represents any official
competition. Champions League-style terminology such as "league phase", "play-offs" and
"Round of 16" is used descriptively.

### Why it exists

Community tournaments are usually run with spreadsheets, chat groups and screenshots.
That works until a competition grows: fixtures collide, standings are calculated by hand,
disputes are lost in chat history, and past seasons disappear. GCC replaces that with a
single platform that is:

- **Trustworthy** — results are verified, calculations are server-side, and every
  important change is auditable.
- **Fair** — fixtures are generated against explicit constraints and validated
  independently before publication.
- **Permanent** — competition records, player statistics, champions and Hall of Fame
  entries are never hard-deleted.
- **Open to communities** — any registered user can compete; any user can apply to
  organise, subject to approval.

## 2. Launch competition format

GCC launches with exactly one competition format: the modern 36-team league phase,
identified as `ucl-league-phase-36`.

### League phase

| Property                | Value |
| ----------------------- | ----- |
| Participants            | 36    |
| Pots                    | 4     |
| Pot size                | 9     |
| Matches per participant | 8     |
| Opponents from each pot | 2     |
| Home matches            | 4     |
| Away matches            | 4     |
| Matchdays               | 8     |
| Total matches           | 144   |

Every participant plays eight different opponents — two drawn from each pot — with four
matches at home and four away. No pair meets twice during the league phase. Each
participant plays exactly one match per matchday, and all 36 participants are in action
on each of the eight matchdays (18 matches per matchday).

### Qualification after matchday 8

| Final position | Outcome                             |
| -------------- | ----------------------------------- |
| 1–8            | Advance directly to the Round of 16 |
| 9–16           | Seeded play-off teams               |
| 17–24          | Unseeded play-off teams             |
| 25–36          | Eliminated                          |

The play-offs fill the remaining eight Round of 16 places: each seeded team is paired
with an unseeded team, and the winners join the eight direct qualifiers. The Round of 16
then proceeds through quarter-finals, semi-finals and the final.

The format is stored as configuration in `src/lib/config/formats.ts` so that additional
formats can be introduced later without rewriting the competition engine.

## 3. Users and roles

### Super Admin

The platform owner. There is exactly one Super Admin, identified **only** by the email
address stored in the server-side environment variable `SUPER_ADMIN_EMAIL`. The address is
never hardcoded and never shipped to the browser. Super Admin status is enforced on the
server and in database policies — not by hiding buttons. The Super Admin approves or
rejects Tournament Admin applications and oversees the whole platform.

### Tournament Admin

Any registered user can apply to become a Tournament Admin. The Super Admin reviews the
application and approves or rejects it. An approved Tournament Admin can create and
manage **only the tournaments they own**. Ownership is enforced on the server and by RLS,
not by navigation.

### Participant

Any registered user. A participant can join multiple tournaments with a single account
and keeps one identity, profile and competitive record across all of them.

## 4. Principles that outlive any tournament

1. **Competition records are permanent.** Results, standings snapshots, knockout ties,
   champions and Hall of Fame entries are never hard-deleted. Corrections are recorded as
   new state plus an audit entry.
2. **The platform is bigger than one season.** Every competition is preserved in archives
   and feeds career statistics and the Hall of Fame.
3. **Server authority.** Scores, roles, fixture calculations and qualification are never
   trusted from the client.
4. **Formats are data.** The engine consumes a format definition; it does not special-case
   one competition.
5. **Honest product.** No fake data, no decorative controls, no placeholder feature
   presented as working.

## 5. What success looks like

- A community organiser can run a full 36-team season without spreadsheets.
- A participant can see fixtures, submit results, follow standings and keep a permanent
  record.
- A dispute can be reviewed with evidence and an audit trail.
- A past season can be revisited years later with its champion, stats and Hall of Fame
  entries intact.
- The platform can host additional competition formats without a rewrite.

## 6. Non-goals for the launch

- Real-time in-game integration or automatic score capture from game publishers.
- Betting, gambling or paid prize distribution.
- Native mobile applications.
- Support for non-football titles at launch (the data model is extensible later).
- Any use of UEFA branding, logos or official competition identity.
