# GCC — Firestore Data Model

> **Status: implemented in Phase 2.** Document shapes live in
> `src/types/domain.ts`, path builders in `src/lib/firebase/paths.ts`, Zod input
> schemas in `src/lib/validation/`, and Security Rules in `firestore.rules`.
>
> Clients read; the server writes. Every write is denied by Security Rules and
> executed by Next.js server code with the Firebase Admin SDK.

## 1. Principles

- **Clients read, the server writes.** Security Rules deny all client writes
  permanently. Every mutation runs in a route handler or server action after
  authentication, authorisation, Zod validation and audit logging where needed.
- **Private and public data are separate documents.** `users/{uid}` holds private
  identity and contact data. `publicProfiles/{uid}` holds display data only.
- **WhatsApp numbers never appear in a public document.** `whatsappE164` exists only
  in `users/{uid}`. Opponents receive contact links through a later server route.
- **Documents are read-optimised.** Firestore has no joins; display snapshots
  (`gamerTag`, `homeTag`, `awayTag`) are refreshed by the server when source data
  changes.
- **Derived values are server-written.** Standings, `registrationCount`, profile
  aggregates and qualification bands are recalculated by the server from verified
  results. Clients never submit computed values.
- **No hard deletes.** Use status changes (`withdrawn`, `removed`, `archived`,
  `suspended`) and audit entries. Competition history is permanent.
- **Server timestamps.** Use Firestore `Timestamp` values written by the server;
  never trust client clocks.
- **Stable identifiers.** Document IDs are server-generated and never reused.
  Gamer-tag uniqueness uses a deterministic lowercase document id.

## 2. Path overview

| Path                                     | Contents                                                                                                                                                                                             | Read access                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `users/{uid}`                            | Private profile: fullName, gamerTag, gamerTagLower, email, whatsappE164, country, preferredGame, platform, photoUrl, status, createdAt, updatedAt                                                    | Owner, Super Admin                                              |
| `users/{uid}/notifications/{id}`         | type, title, body, link, read, createdAt                                                                                                                                                             | Owner                                                           |
| `publicProfiles/{uid}`                   | gamerTag, country, preferredGame, platform, photoUrl, aggregate stats                                                                                                                                | Anyone                                                          |
| `gamerTags/{gamerTagLower}`              | `{ uid, createdAt }` uniqueness reservation                                                                                                                                                          | Nobody (server only)                                            |
| `adminApplications/{id}`                 | uid, communityName, experience, motivation, expectedPlayers, contact details, status, reviewer fields, timestamps                                                                                    | Applicant, Super Admin                                          |
| `tournaments/{id}`                       | ownerUid, slug, name, description, gameId, formatId, coverImageUrl, rules, matchDurationMinutes, timezone, registration/starts dates, maxParticipants, registrationCount, status, season, timestamps | Public unless `draft`/`suspended`; owner and Super Admin always |
| `tournaments/{id}/registrations/{uid}`   | Public-safe snapshot: gamerTag, country, photoUrl, status, registeredAt                                                                                                                              | Public with a public tournament; owner and Super Admin always   |
| `tournaments/{id}/draw/current`          | pots `{1:[uid…],2:[…],3:[…],4:[…]}`, method, shuffleSeed, confirmedAt, confirmedBy                                                                                                                   | Owner/Super Admin before confirmation; public after             |
| `tournaments/{id}/fixtureDrafts/current` | Generated unpublished fixtures and validation report                                                                                                                                                 | Owner, Super Admin                                              |
| `tournaments/{id}/matches/{matchId}`     | stage, matchday, homeUid, awayUid, homeTag, awayTag, participants, status, scheduledAt, deadlineAt, result, pendingResult, confirmedAt, updatedAt                                                    | Owner/Super Admin always; public once fixtures are published    |
| `tournaments/{id}/disputes/{id}`         | matchId, raisedBy, submissions, evidenceNotes, status, resolution, resolvedBy, reason, timestamps                                                                                                    | Match participants, owner, Super Admin                          |
| `tournaments/{id}/standings/{uid}`       | Derived gamerTag, MP, W, D, L, GF, GA, GD, Pts, position, qualificationBand                                                                                                                          | Public with a public tournament; owner and Super Admin always   |
| `tournaments/{id}/knockoutTies/{id}`     | round, seeds, legs, aggregate, winnerUid, status                                                                                                                                                     | Public with a public tournament; owner and Super Admin always   |
| `tournaments/{id}/announcements/{id}`    | title, body, authorUid, publishedAt                                                                                                                                                                  | Public with a public tournament; owner and Super Admin always   |
| `announcements/{id}`                     | Platform-wide title, body, authorUid, publishedAt                                                                                                                                                    | Anyone                                                          |
| `hallOfFame/{id}`                        | tournamentId, season, championUid/tag, finalistUid/tag, thirdPlace, stats                                                                                                                            | Anyone                                                          |
| `auditLogs/{id}`                         | actorUid, actorRole, action, targetType, targetId, tournamentId, before, after, reason, createdAt                                                                                                    | Super Admin only                                                |
| `rateLimits/{key}`                       | key, count, windowStart, expiresAt, updatedAt                                                                                                                                                        | Nobody (server only)                                            |
| `platformStats/summary`                  | totalUsers, totalTournaments, totalMatches, activeTournaments, updatedAt                                                                                                                             | Super Admin only                                                |

The canonical path builders are in `src/lib/firebase/paths.ts`. Server code must
use them rather than hand-building strings.

## 3. Collection detail

### 3.1 `users/{uid}` — private profile

Document id: Firebase Auth UID.

| Field                     | Type            | Notes                                |
| ------------------------- | --------------- | ------------------------------------ |
| `fullName`                | string          | 2–80 characters                      |
| `gamerTag`                | string          | Display casing, 3–24 characters      |
| `gamerTagLower`           | string          | Normalised uniqueness key            |
| `email`                   | string          | Mirrors the verified Auth email      |
| `whatsappE164`            | string \| null  | Private contact number; never public |
| `country`                 | string          | ISO 3166-1 alpha-2                   |
| `preferredGame`           | `GameId`        | Configured game id                   |
| `platform`                | `PlatformId`    | Configured platform id               |
| `photoUrl`                | string \| null  | Remote URL only; Storage is not used |
| `status`                  | `AccountStatus` | `active`, `suspended`, `banned`      |
| `createdAt` / `updatedAt` | Timestamp       | Server-written                       |

**Writer:** profile server actions (Phase 4), account-status management (Phase 2).
**Readers:** owner and Super Admin. No public read.

### 3.2 `publicProfiles/{uid}` — public profile

Document id: UID. Contains only fields safe to show to anyone. Aggregates are
refreshed by the server after confirmed results:

`gamerTag`, `country`, `preferredGame`, `platform`, `photoUrl`, `tournaments`,
`played`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `titles`.

**Writer:** server only. **Readers:** anyone.

### 3.3 `gamerTags/{gamerTagLower}` — uniqueness reservation

```text
{ uid: string, createdAt: Timestamp }
```

The document id is the normalised gamer tag. Profile creation/update runs a
Firestore transaction that creates this reservation and updates the private
profile together. A failed transaction leaves no partial reservation.
**Readers:** nobody. **Writer:** server only (Phase 4).

### 3.4 `adminApplications/{id}` — Tournament Admin applications

| Field                                    | Type                              |
| ---------------------------------------- | --------------------------------- |
| `uid`                                    | applicant UID                     |
| `communityName`                          | string                            |
| `experience`, `motivation`               | string                            |
| `expectedPlayers`                        | number                            |
| `contactEmail`                           | string                            |
| `contactWhatsappE164`                    | string \| null                    |
| `status`                                 | `pending`, `approved`, `rejected` |
| `reviewedBy`, `reviewedAt`, `reviewNote` | reviewer audit data               |
| `createdAt`, `updatedAt`                 | Timestamp                         |

**Writers:** applicant submission and Super Admin review through server code.
**Readers:** the applicant (`resource.data.uid == request.auth.uid`) and Super Admin.

### 3.5 `tournaments/{id}` — tournament

| Field                                                     | Type               | Notes                                         |
| --------------------------------------------------------- | ------------------ | --------------------------------------------- |
| `ownerUid`                                                | string             | Authoritative owner, checked server-side      |
| `slug`                                                    | string             | Public URL slug, unique by server check       |
| `name`, `description`, `rules`                            | string             | Display content                               |
| `gameId`, `formatId`                                      | IDs                | `formatId` is `ucl-league-phase-36` at launch |
| `coverImageUrl`                                           | string \| null     | Remote URL only                               |
| `matchDurationMinutes`                                    | number             | Scheduling configuration                      |
| `timezone`                                                | string             | IANA identifier, default `Africa/Nairobi`     |
| `registrationOpensAt`, `registrationClosesAt`, `startsAt` | Timestamp          | Ordered by validation                         |
| `maxParticipants`                                         | number             | Defaults to 36                                |
| `registrationCount`                                       | number             | Server-derived                                |
| `status`                                                  | `TournamentStatus` | Lifecycle below                               |
| `season`                                                  | string             | Display season label                          |
| `createdAt`, `updatedAt`                                  | Timestamp          | Server-written                                |

**Tournament lifecycle** (`canTransition` in `src/types/domain.ts`):

```text
draft → registration_open → registration_closed → pots_confirmed →
fixtures_published → league_phase → knockout → completed → archived
```

Any non-completed, non-archived stage may be suspended. A suspended tournament
may resume at a non-archived stage. `archived` is terminal.

**Writers:** owner server routes and Super Admin actions. **Readers:** public when
the status is not `draft` or `suspended`; owner and Super Admin always.

### 3.6 `tournaments/{id}/registrations/{uid}` — registration snapshot

Public-safe fields only: `gamerTag`, `country`, `photoUrl`, `status`
(`registered`, `withdrawn`, `removed`), `registeredAt`. Contact data is never
copied here. Document id is the participant UID, which makes duplicate
registration impossible. **Writers:** server only (Phase 8).

### 3.7 `tournaments/{id}/draw/current` — pots

```text
{
  pots: { "1": string[9], "2": string[9], "3": string[9], "4": string[9] },
  method: "manual" | "shuffle",
  shuffleSeed: string | null,
  confirmedAt: Timestamp | null,
  confirmedBy: string | null
}
```

Pots are plain: no country restrictions. Every admin shuffle records the actor,
method and seed in the audit log (Phase 9). The public can read the draw only
after `confirmedAt` is set and the tournament is public.

### 3.8 `tournaments/{id}/fixtureDrafts/current` — unpublished schedule

Contains `generatedBy`, `generatedAt`, `fixtures[]` and
`validation: { valid, issues[] }`. Only the owner and Super Admin can read it.
Publishing copies validated fixtures into `matches` through a server transaction
and writes an audit entry (Phase 10).

### 3.9 `tournaments/{id}/matches/{matchId}` — fixture and result state

| Field                       | Type                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `stage`                     | `league`, `playoff`, `r16`, `qf`, `sf`, `final`              |
| `matchday`                  | number                                                       |
| `homeUid`, `awayUid`        | participant UIDs                                             |
| `homeTag`, `awayTag`        | display snapshots                                            |
| `participants`              | `[homeUid, awayUid]`, used by rules for dispute access       |
| `status`                    | `MatchStatus`                                                |
| `scheduledAt`, `deadlineAt` | Timestamp                                                    |
| `result`                    | `{ homeGoals, awayGoals, source }` or null                   |
| `pendingResult`             | `{ submittedBy, homeGoals, awayGoals, submittedAt }` or null |
| `confirmedAt`               | Timestamp or null                                            |
| `updatedAt`                 | Timestamp                                                    |

A submitted result is provisional. Only a server-confirmed result changes
standings. Match statuses: `scheduled`, `awaiting_result`,
`awaiting_confirmation`, `confirmed`, `disputed`, `completed`, `forfeited`.

Fixtures become client-readable when the tournament reaches
`fixtures_published`; drafts and suspended tournaments stay private.

### 3.10 `tournaments/{id}/disputes/{id}` — disputes

Fields: `matchId`, `raisedBy`, `submissions[]` (submitter, note, timestamp),
`evidenceNotes`, `status` (`open`, `under_review`, `resolved`, `rejected`),
`resolution`, `resolvedBy`, `reason`, `createdAt`, `updatedAt`.

Security Rules resolve the match from `matchId` and allow reads only when the
caller is in `match.participants`, is the tournament owner, or is Super Admin.

### 3.11 `tournaments/{id}/standings/{uid}` — derived table row

Fields: `gamerTag`, `MP`, `W`, `D`, `L`, `GF`, `GA`, `GD`, `Pts`, `position`,
`qualificationBand`. Document id is the participant UID. The server recalculates
rows from confirmed results; clients never write them.

### 3.12 `tournaments/{id}/knockoutTies/{id}` — knockout tie

Fields: `round`, `seeds { home, away }`, `legs[]`, `aggregate { homeGoals,
awayGoals }`, `winnerUid`, `status` (`scheduled`, `in_progress`, `completed`).

### 3.13 Announcements

- `tournaments/{id}/announcements/{id}`: title, body, authorUid, publishedAt.
  Public with a public tournament.
- `announcements/{id}`: platform-wide announcement with the same fields.
  Public.

### 3.14 `users/{uid}/notifications/{id}` — notifications

Fields: `type`, `title`, `body`, `link`, `read`, `createdAt`. Only the owner can
read. A server route marks notifications read (Phase 16).

### 3.15 `hallOfFame/{id}` — permanent champions

Fields: `tournamentId`, `season`, `championUid`, `championTag`, `finalistUid`,
`finalistTag`, `thirdPlace { uid, tag } | null`, `stats { played, wins, draws,
losses, goalsFor, goalsAgainst }`. Public and never deleted.

### 3.16 `auditLogs/{id}` — append-only audit trail

Fields: `actorUid`, `actorRole`, `action`, `targetType`, `targetId`,
`tournamentId`, `before`, `after`, `reason`, `createdAt`. Written by
`src/lib/audit/log.ts`; readable only by Super Admin.

### 3.17 `rateLimits/{key}` — fixed-window counters

Fields: `key`, `count`, `windowStart`, `expiresAt`, `updatedAt` (epoch
milliseconds). The document id is a SHA-256 hash of the caller key. Written by
`src/lib/rate-limit/index.ts` inside a Firestore transaction. Not client-readable.

### 3.18 `platformStats/summary` — owner overview counters

Fields: `totalUsers`, `totalTournaments`, `totalMatches`, `activeTournaments`,
`updatedAt`. Super Admin only.

## 4. Relationships

```text
Firebase Auth user
  ├── users/{uid}
  │     └── notifications/{id}
  ├── publicProfiles/{uid}
  └── gamerTags/{gamerTagLower}  (reservation points at uid)

tournaments/{id}
  ├── registrations/{uid}
  ├── draw/current
  ├── fixtureDrafts/current
  ├── matches/{matchId}
  ├── disputes/{disputeId}       (carries matchId)
  ├── standings/{uid}
  ├── knockoutTies/{tieId}
  └── announcements/{id}

adminApplications/{id} ── uid ── users/{uid}
auditLogs/{id} ── actorUid ── users/{uid}
hallOfFame/{id} ── tournamentId ── tournaments/{id}
```

## 5. Composite indexes

`firestore.indexes.json` declares:

| Collection group    | Fields                                            | Use                                  |
| ------------------- | ------------------------------------------------- | ------------------------------------ |
| `matches`           | `participants` ARRAY_CONTAINS + `matchday` ASC    | A participant's fixtures by matchday |
| `matches`           | `participants` ARRAY_CONTAINS + `scheduledAt` ASC | A participant's schedule             |
| `matches`           | `status` ASC + `matchday` ASC                     | Operations queues                    |
| `tournaments`       | `status` ASC + `startsAt` ASC                     | Public discovery                     |
| `tournaments`       | `ownerUid` ASC + `updatedAt` DESC                 | Organiser dashboard                  |
| `registrations`     | `status` ASC + `registeredAt` ASC                 | Registration review                  |
| `notifications`     | `createdAt` DESC                                  | User notification feed               |
| `auditLogs`         | `createdAt` DESC                                  | Audit log viewer                     |
| `auditLogs`         | `actorUid` ASC + `createdAt` DESC                 | Actor history                        |
| `adminApplications` | `status` ASC + `createdAt` DESC                   | Review queue                         |
| `standings`         | `position` ASC                                    | Public table                         |

Add an index only with the query that needs it. Deploy with
`firebase deploy --only firestore:indexes`.

## 6. Security Rules summary

- Default deny. `allow write: if false` for every document.
- Public reads: `publicProfiles`, platform `announcements`, `hallOfFame`.
- Private reads: `users` (owner/Super Admin), notifications (owner),
  `adminApplications` (applicant/Super Admin), `auditLogs` and
  `platformStats` (Super Admin).
- `gamerTags` and `rateLimits` have no client read at all.
- Tournaments and their subcollections are hidden while `draft` or `suspended`.
- Fixture drafts are owner/Super Admin only.
- Disputes require match participation, ownership or Super Admin.
- Super Admin checks require both the `role == "super_admin"` custom claim and a
  verified email.
- Rules tests live in `tests/rules/` and run with `npm run test:rules`. The
  emulator requires Java 11+.

## 7. Planned write boundaries

| Phase | Server write                                                        |
| ----- | ------------------------------------------------------------------- |
| 2     | Session exchange, role/status administration, audit and rate limits |
| 4     | Profile + gamerTag reservation transaction                          |
| 6     | Admin application submission/review                                 |
| 8     | Tournament create/update/publish, registration                      |
| 9     | Draw generation, admin shuffle, confirmation                        |
| 10    | Fixture draft generation and publication                            |
| 11    | Result submission, confirmation, dispute resolution                 |
| 12    | Standings recomputation and snapshots                               |
| 13    | Knockout progression                                                |
| 16    | Notifications and announcements                                     |
| 17    | Hall of Fame induction and profile aggregates                       |

No client write path exists in any phase.
