# GCC — Firestore Data Model

> **Status: implemented through Phase 5.** Document shapes live in
> `src/types/domain.ts`, path builders in `src/lib/firebase/paths.ts`, Zod input
> schemas in `src/lib/validation/`, and Security Rules in `firestore.rules`.
>
> Clients read; the server writes. Every write is denied by Security Rules and
> executed by Next.js server code with the Firebase Admin SDK.
>
> Results are entered by the tournament owner or Super Admin only. Players never
> submit or confirm scores; they can open a `resultReports` document to ask an
> admin to review a recorded result.

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

| Path                                          | Contents                                                                                                                                                                                               | Read access                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `users/{uid}`                                 | Private profile: fullName, gamerTag, gamerTagLower, email, whatsappE164, country, preferredGame, platform, community, favouriteClub, photoUrl, avatarUrl, avatarPublicId, status, createdAt, updatedAt | Owner, Super Admin                                               |
| `users/{uid}/notifications/{id}`              | type, title, body, link, read, createdAt                                                                                                                                                               | Owner                                                            |
| `users/{uid}/memberships/{tournamentId}`      | tournamentId, slug, name, gameId, status, registeredAt                                                                                                                                                 | Owner                                                            |
| `publicProfiles/{uid}`                        | gamerTag, gamerTagLower, country, preferredGame, platform, community, favouriteClub, photoUrl, avatarUrl, avatarPublicId, status, typed stats                                                          | Anyone                                                           |
| `publicProfiles/{uid}/history/{tournamentId}` | tournamentName, slug, season, gameId, finalPosition, played, wins, draws, losses, goalsFor, goalsAgainst, wonTitle, completedAt                                                                        | Anyone                                                           |
| `gamerTags/{gamerTagLower}`                   | `{ uid, createdAt }` uniqueness reservation                                                                                                                                                            | Nobody (server only)                                             |
| `adminApplications/{id}`                      | uid, communityName, experience, motivation, expectedPlayers, contact details, status, reviewer fields, timestamps                                                                                      | Applicant, Super Admin                                           |
| `tournaments/{id}`                            | ownerUid, slug, name, description, gameId, formatId, coverImageUrl, rules, matchDurationMinutes, timezone, registration/starts dates, maxParticipants, registrationCount, status, season, timestamps   | Public unless `draft`/`suspended`; owner and Super Admin always  |
| `tournaments/{id}/registrations/{uid}`        | tournamentId, gamerTag, country, photoUrl, status, registeredAt                                                                                                                                        | Public with a public tournament; owner and Super Admin always    |
| `tournaments/{id}/draw/current`               | pots `{1:[uid…],2:[…],3:[…],4:[…]}`, method, shuffleSeed, confirmedAt, confirmedBy                                                                                                                     | Owner/Super Admin before confirmation; public after              |
| `tournaments/{id}/fixtureDrafts/current`      | Generated unpublished fixtures and validation report                                                                                                                                                   | Owner, Super Admin                                               |
| `tournaments/{id}/matches/{matchId}`          | tournamentId, stage, matchday, homeUid, awayUid, homeTag, awayTag, participants, status, scheduledAt, result, updatedAt                                                                                | Owner/Super Admin always; public once fixtures are published     |
| `tournaments/{id}/resultReports/{id}`         | matchId, reportedBy, reportedByTag, reason, status, adminNote, resolvedBy, resolvedAt, createdAt                                                                                                       | Reporter, owner, Super Admin                                     |
| `tournaments/{id}/standings/{uid}`            | Derived gamerTag, MP, W, D, L, GF, GA, GD, Pts, position, qualificationBand                                                                                                                            | Public with a public tournament; owner and Super Admin always    |
| `tournaments/{id}/knockoutTies/{id}`          | round, seeds, legs, aggregate, winnerUid, status                                                                                                                                                       | Public with a public tournament; owner and Super Admin always    |
| `tournaments/{id}/announcements/{id}`         | title, body, authorUid, publishedAt                                                                                                                                                                    | Public with a public tournament; owner and Super Admin always    |
| `announcements/{id}`                          | Platform-wide title, body, severity, pinned, publishedAt, expiresAt, authorUid, createdAt, updatedAt, deletedAt                                                                                        | Published, unexpired, non-deleted: anyone; otherwise Super Admin |
| `hallOfFame/{id}`                             | tournamentId, season, championUid/tag, finalistUid/tag, thirdPlace, stats                                                                                                                              | Anyone                                                           |
| `auditLogs/{id}`                              | actorUid, actorRole, action, targetType, targetId, tournamentId, before, after, reason, createdAt                                                                                                      | Super Admin only                                                 |
| `rateLimits/{key}`                            | key, count, windowStart, expiresAt, updatedAt                                                                                                                                                          | Nobody (server only)                                             |
| `platformSettings/main`                       | maintenanceMode, maintenanceMessage, registrationsOpen, maxActiveTournamentsPerOrganiser, applicationCooldownDays, updatedBy, updatedAt                                                                | Super Admin only (public fields served by a server helper)       |
| `platformStats/summary`                       | totalUsers, totalTournaments, totalMatches, activeTournaments plus Phase 5 analytics fields, updatedAt                                                                                                 | Super Admin only                                                 |

The canonical path builders are in `src/lib/firebase/paths.ts`. Server code must
use them rather than hand-building strings.

## 3. Collection detail

### 3.1 `users/{uid}` — private profile

Document id: Firebase Auth UID.

| Field                     | Type            | Notes                                                  |
| ------------------------- | --------------- | ------------------------------------------------------ |
| `fullName`                | string          | 2–60 characters                                        |
| `gamerTag`                | string          | Display casing, 3–16 characters, immutable             |
| `gamerTagLower`           | string          | Normalised uniqueness key                              |
| `email`                   | string          | Mirrors the verified Auth email                        |
| `whatsappE164`            | string \| null  | Private contact number; never public                   |
| `country`                 | string          | ISO 3166-1 alpha-2                                     |
| `preferredGame`           | `GameId`        | Configured game id                                     |
| `platform`                | `PlatformId`    | Configured platform id                                 |
| `community`               | string \| null  | Optional, max 40 characters, e.g. "UON Esports Club"   |
| `favouriteClub`           | string \| null  | Optional, max 40 characters; plain text, no club logos |
| `photoUrl`                | string \| null  | Legacy remote image URL; Storage is not used           |
| `avatarUrl`               | string \| null  | Cloudinary delivery URL for the avatar                 |
| `avatarPublicId`          | string \| null  | Cloudinary public id, used by server-side replacement  |
| `role`                    | `UserRole`      | **Display only.** Custom claims are the only authority |
| `status`                  | `AccountStatus` | `active`, `suspended`, `banned`                        |
| `createdAt` / `updatedAt` | Timestamp       | Server-written                                         |

**Writer:** registration, profile edit and avatar routes (Phase 4); account-status
management (Phase 2).
**Readers:** owner and Super Admin. No public read. Any `role` field kept here is
for display only; authorisation always reads the Firebase custom claim.

### 3.2 `publicProfiles/{uid}` — public profile

Document id: UID. Contains only fields safe to show to anyone. Aggregates are
refreshed by the server; Phase 17 computes them and Phase 3B defines the shape.

Display fields: `gamerTag`, `gamerTagLower` (for prefix search), `country`,
`preferredGame`, `platform`, `community`, `favouriteClub`, `photoUrl`,
`avatarUrl`, `avatarPublicId`, `status`.

`status` mirrors `users/{uid}.status`. Suspended and banned profiles show
"Profile unavailable" instead of player details, so account enforcement does not
leave a live public identity behind. The server writes both documents together
when the Super Admin changes an account status.

`stats` is typed as:

```text
{
  overall: {
    tournaments, played, wins, draws, losses, goalsFor, goalsAgainst, titles
  },
  byGame: {
    [gameId]: {
      tournaments, played, wins, draws, losses, goalsFor, goalsAgainst, titles,
      rating: number | null,
      ratedMatches: number
    }
  }
}
```

Every counter defaults to zero and `rating` defaults to `null`. `byGame` is
partial: a game appears only after the player has played it.

`publicProfiles/{uid}/history/{tournamentId}` stores a public career-history
snapshot for a completed tournament: `tournamentName`, `slug`, `season`,
`gameId`, `finalPosition`, `played`, `wins`, `draws`, `losses`, `goalsFor`,
`goalsAgainst`, `wonTitle`, `completedAt`.

**Writer:** server only. **Readers:** anyone.

### 3.3 `gamerTags/{gamerTagLower}` — uniqueness reservation

```text
{ uid: string, createdAt: Timestamp }
```

The document id is the normalised (lowercase) gamer tag. Registration runs a
Firestore transaction that, in order, creates this reservation with
`transaction.create()`, creates `users/{uid}` and creates `publicProfiles/{uid}`.
A tag may contain letters, digits, dots, underscores and hyphens, must start and
end with a letter or digit, may not repeat a special character and may not be a
reserved platform word. `transaction.create()` makes the tag race-safe: a
concurrent registration for the same lowercase tag fails, the Auth user created
for that attempt is deleted, and no partial reservation remains. The display
casing in `gamerTag` is preserved; `gamerTagLower` is the uniqueness key.

Gamer tags are immutable after creation. `PATCH /api/profile` rejects the field.
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

Public-safe fields only: `tournamentId`, `gamerTag`, `country`, `photoUrl`,
`status` (`registered`, `withdrawn`, `removed`), `registeredAt`. Contact data is
never copied here. Document id is the participant UID, which makes duplicate
registration impossible. `tournamentId` is duplicated so collection-group
queries can be scoped to one tournament without leaking a hidden one.
**Writers:** server only (Phase 8).

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

| Field                | Type                                                          |
| -------------------- | ------------------------------------------------------------- |
| `tournamentId`       | parent tournament id, duplicated for collection-group queries |
| `stage`              | `league`, `playoff`, `r16`, `qf`, `sf`, `final`               |
| `matchday`           | number                                                        |
| `homeUid`, `awayUid` | participant UIDs                                              |
| `homeTag`, `awayTag` | display snapshots                                             |
| `participants`       | `[homeUid, awayUid]`, used by history queries and rules       |
| `status`             | `MatchStatus`                                                 |
| `scheduledAt`        | Timestamp                                                     |
| `result`             | `MatchResult` or null                                         |
| `updatedAt`          | Timestamp                                                     |

```text
MatchResult = {
  homeGoals, awayGoals,
  enteredBy, enteredAt,
  lastEditedBy?, lastEditedAt?,
  editCount
}
```

Match statuses are only `scheduled` and `completed`. A result is final when it is
recorded by the tournament owner or a Super Admin; there is no participant
submission, confirmation or dispute stage. Corrections require a reason, are
audit-logged with before/after values and increment `editCount`.

Fixtures become client-readable when the tournament reaches
`fixtures_published`; drafts and suspended tournaments stay private.

### 3.10 `tournaments/{id}/resultReports/{id}` — player "Report a problem"

Fields: `matchId`, `reportedBy`, `reportedByTag`, `reason` (max 500), `status`
(`open`, `resolved`, `dismissed`), `adminNote`, `resolvedBy`, `resolvedAt`,
`createdAt`.

A result report is a player-to-admin channel only. It never changes an official
result. Reads are allowed for the reporter, the tournament owner and the Super
Admin; writes remain deny-all. Any correction is made on the match document
through the admin result workflow and recorded in `auditLogs`.

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
- `announcements/{id}`: platform-wide notice with `title` (max 100), `body` (max
  2000, plain text), `severity` (`info` or `important`), `pinned`,
  `publishedAt` (null while a draft), optional `expiresAt`, `authorUid`,
  `createdAt`, `updatedAt` and `deletedAt`. Public readers see only entries that
  are published, not soft-deleted and not expired. The Super Admin console reads
  drafts and deleted entries through the Admin SDK. Deletion is soft: the server
  sets `deletedAt` and clears `publishedAt`; the record is retained.

  Writes are server-only, one route per transition: create, edit, publish,
  unpublish and delete. Each transition is audited. The signed-in banner shows
  pinned or active notices and remembers dismissals in `localStorage` per
  announcement id.

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

Phase 5 actions: `user.status.set`, `user.role.set`, `user.contact_revealed`,
`platform.settings.updated`, `announcement.created`, `announcement.updated`,
`announcement.published`, `announcement.unpublished` and
`announcement.deleted`. `src/lib/audit/actions.ts` is the register of known
actions and their human-readable labels. Payloads are redacted before display
(see `src/lib/audit/redact.ts`); phone numbers are never written to an audit
entry. `user.contact_revealed` records only that a reveal happened, not the
number.

### 3.17 `rateLimits/{key}` — fixed-window counters

Fields: `key`, `count`, `windowStart`, `expiresAt`, `updatedAt` (epoch
milliseconds). The document id is a SHA-256 hash of the caller key. Written by
`src/lib/rate-limit/index.ts` inside a Firestore transaction. Not client-readable.

### 3.18 `platformStats/summary` — Super Admin analytics

Cached summary refreshed on demand from the overview/analytics pages and the
Refresh action. Figures that can be counted use Firestore `count()`
aggregations.

Exact counters: `totalUsers`, `totalTournaments`, `totalMatches`,
`activeTournaments`, `totalRegistrations`, plus `tournamentsByStatus`.
Breakdowns: `signupsByDay` (last 30 days), `usersByCountry`, `usersByGame` and
`usersByPlatform`. Breakdowns and the daily series are derived from a bounded
sample of at most `sampleCap` (`USER_SAMPLE_CAP = 1000`) user documents;
`usersSampled` records how many were read so the UI can be honest about it.

Cache metadata: `generatedAt` and `updatedAt`. The console treats a summary
older than five minutes as stale and offers a manual Refresh; it never claims a
cached figure is live. Super Admin only.

### 3.19 `users/{uid}/memberships/{tournamentId}` — "My Tournaments"

Fields: `tournamentId`, `slug`, `name`, `gameId`, `status` (`TournamentStatus`),
`registeredAt`. Written by the server when a registration is created or its
status changes. Owner-read only, so a player can list their tournaments without
a broad collection-group read over registrations.

### 3.20 `publicProfiles/{uid}/history/{tournamentId}` — public career history

Fields: `tournamentName`, `slug`, `season`, `gameId`, `finalPosition`, `played`,
`wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `wonTitle`,
`completedAt`. Written by the server when a tournament is completed. Public
read, never deleted.

### 3.21 `platformSettings/main` — platform configuration

The single settings document. Document id is always `main`.

| Field                              | Type      | Notes                                                        |
| ---------------------------------- | --------- | ------------------------------------------------------------ |
| `maintenanceMode`                  | boolean   | When true, non-Super-Admin writes return 503                 |
| `maintenanceMessage`               | string    | Max 300 characters; shown on the banner and in 503 responses |
| `registrationsOpen`                | boolean   | Default `true`; when false, registration is rejected clearly |
| `maxActiveTournamentsPerOrganiser` | number    | Integer 1–20, default 3                                      |
| `applicationCooldownDays`          | number    | Integer 0–90, default 7                                      |
| `updatedBy`                        | string    | UID of the acting Super Admin                                |
| `updatedAt`                        | Timestamp | Server-written                                               |

**Writer:** `PATCH /api/super-admin/settings` only, after the shared guard.
**Readers:** Super Admin only by Security Rules. Public pages never read the
document; `src/lib/platform/settings.ts` returns only `maintenanceMode`,
`maintenanceMessage` and `registrationsOpen` through the Admin SDK. Missing
documents fall back to the defaults above.

Every other state-changing route calls `assertPlatformWritable(user)` first, so
maintenance mode is enforced in one place. `assertRegistrationsOpen()` adds the
registration-specific rejection. The Super Admin is never blocked.

## 4. Relationships

```text
Firebase Auth user
  ├── users/{uid}
  │     ├── notifications/{id}
  │     └── memberships/{tournamentId}
  ├── publicProfiles/{uid}
  │     └── history/{tournamentId}
  └── gamerTags/{gamerTagLower}  (reservation points at uid)

tournaments/{id}
  ├── registrations/{uid}          (carries tournamentId)
  ├── draw/current
  ├── fixtureDrafts/current
  ├── matches/{matchId}            (carries tournamentId; result is admin-entered)
  ├── resultReports/{reportId}     (carries matchId)
  ├── standings/{uid}
  ├── knockoutTies/{tieId}
  └── announcements/{id}

adminApplications/{id} ── uid ── users/{uid}
auditLogs/{id} ── actorUid ── users/{uid}
auditLogs/{id} ── targetType/targetId ── users/{uid} or announcements/{id}
announcements/{id} ── authorUid ── users/{uid}
platformSettings/main ── updatedBy ── users/{uid}
hallOfFame/{id} ── tournamentId ── tournaments/{id}
```

## 5. Composite indexes

`firestore.indexes.json` declares 38 composite indexes:

| Collection group    | Fields                                                                                                       | Use                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `matches`           | `participants` ARRAY_CONTAINS + `matchday` ASC                                                               | A participant's fixtures by matchday                            |
| `matches`           | `participants` ARRAY_CONTAINS + `scheduledAt` ASC                                                            | A participant's schedule                                        |
| `matches`           | `participants` ARRAY_CONTAINS + `updatedAt` DESC                                                             | A player's match history                                        |
| `matches`           | `tournamentId` ASC + `participants` ARRAY_CONTAINS + `updatedAt` DESC                                        | Scoped player history that rules can prove is public            |
| `matches`           | `status` ASC + `matchday` ASC                                                                                | Operations queues                                               |
| `tournaments`       | `status` ASC + `startsAt` ASC                                                                                | Public discovery                                                |
| `tournaments`       | `ownerUid` ASC + `updatedAt` DESC                                                                            | Organiser dashboard                                             |
| `tournaments`       | `status` ASC + `createdAt` DESC                                                                              | Super Admin tournament list, newest first                       |
| `tournaments`       | `status` ASC + `name` ASC                                                                                    | Super Admin tournament name search                              |
| `registrations`     | `status` ASC + `registeredAt` ASC                                                                            | Registration review                                             |
| `registrations`     | `tournamentId` ASC + `registeredAt` DESC                                                                     | Scoped player registration history                              |
| `users`             | Any non-empty subset of `role`, `status`, `country`, `preferredGame` in that fixed order, + `createdAt` DESC | Super Admin user list and every filter combination (15 indexes) |
| `auditLogs`         | `action` / `actorUid` / `targetType` singly or in combination, + `createdAt` DESC                            | Audit viewer filters (7 indexes)                                |
| `auditLogs`         | `targetType` ASC + `targetId` ASC + `createdAt` DESC                                                         | User-detail audit history                                       |
| `announcements`     | `deletedAt` ASC + `createdAt` DESC                                                                           | Admin announcement list                                         |
| `announcements`     | `deletedAt` ASC + `publishedAt` DESC                                                                         | Public announcement list                                        |
| `adminApplications` | `status` ASC + `createdAt` DESC                                                                              | Review queue (Phase 6)                                          |
| `adminApplications` | `uid` ASC + `createdAt` DESC                                                                                 | Applicant history (Phase 6)                                     |

The user-filter queries must include equality fields in canonical order
(`role`, `status`, `country`, `preferredGame`) followed by `createdAt DESC`;
`src/lib/super-admin/users.ts` builds the query in that order. Single-field
indexes such as `notifications.createdAt` and `standings.position` are created
automatically by Firestore and are not declared here.

Add an index only with the query that needs it. Deploy rules and indexes with
`npm run rules:deploy`.

## 6. Security Rules summary

- Default deny. `allow write: if false` for every document.
- Public reads: `publicProfiles` (including `history` subcollection), published
  and unexpired platform `announcements`, `hallOfFame`.
- Draft, expired and soft-deleted platform announcements are readable only by
  the Super Admin.
- Private reads: `users` (owner/Super Admin), notifications and memberships
  (owner), `adminApplications` (applicant/Super Admin), `auditLogs`,
  `platformStats` and `platformSettings` (Super Admin).
- `gamerTags` and `rateLimits` have no client read at all.
- Tournaments and their subcollections are hidden while `draft` or `suspended`.
- Fixture drafts are owner/Super Admin only.
- Result reports are readable by the reporter, the tournament owner and the
  Super Admin. They are not an official result workflow.
- Collection-group reads for `matches` and `registrations` resolve the parent
  tournament from `resource.data.tournamentId`. A query that does not constrain
  `tournamentId` fails rather than exposing a hidden tournament's documents.
- Super Admin checks require both the `role == "super_admin"` custom claim and a
  verified email.
- Rules tests live in `tests/rules/` and run with `npm run test:rules`. The
  emulator requires Java 21.

## 7. Planned write boundaries

| Phase | Server write                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------ |
| 2     | Session exchange, role/status administration, audit and rate limits                              |
| 4     | Atomic registration, profile edit, avatar upload/removal                                         |
| 5     | Platform settings, account status/role actions, contact reveal, announcements, analytics refresh |
| 6     | Admin application submission/review                                                              |
| 8     | Tournament create/update/publish, registration, membership snapshot                              |
| 9     | Draw generation, admin shuffle, confirmation                                                     |
| 10    | Fixture draft generation and publication                                                         |
| 11    | Admin-only result entry, corrections, result-report decisions                                    |
| 12    | Standings recomputation and snapshots                                                            |
| 13    | Knockout progression                                                                             |
| 16    | Notifications and announcements                                                                  |
| 17    | Hall of Fame induction, profile stats and history snapshots                                      |

No client write path exists in any phase.
