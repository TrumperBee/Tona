# TTL and public-data caching

This document records the Phase 18A Firestore TTL policy and the public read-cache contract. It is the source of truth for TTL configuration; do not add conflicting TTL guidance to other security docs unless they explicitly point here.

## Firestore TTL

Firestore TTL is configured per **collection group** on a single `Date and time` field. Documents are typically deleted within 24 hours after the field value passes; TTL deletion is not immediate and must not be used for security-critical expiry.

Source: [Firestore TTL overview](https://firebase.google.com/docs/firestore/ttl)

### Configured policy

| Collection group | TTL field   | Field type                                            | Policy     | Notes                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------- | ----------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rateLimits`     | `expiresAt` | Firestore `Timestamp` / Cloud Firestore Date and time | **Enable** | Rate-limit counters are server-only operational data. `expiresAt` is set to the end of the fixed window by `src/lib/rate-limit/index.ts` (`rateLimitExpiryTimestamp`). Old counters may remain readable to the Admin SDK for up to ~24h after expiry; server logic already treats expired windows as inactive. |

### Explicit no-TTL decisions

| Collection group / field  | TTL policy           | Reason                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `announcements.expiresAt` | **Do not configure** | `expiresAt` controls public visibility/expiry on the announcements page and banner. It is not a deletion timestamp. Expired announcements may still be useful for admin history and auditability. The public rules and queries filter expired announcements out of public reads. |

## Public-data cache

Public Firestore reads are cached through `src/lib/cache/public-data.ts`.

- **Tag:** `public-data` (`PUBLIC_DATA_TAG`)
- **Backstop revalidation:** `300` seconds (`PUBLIC_DATA_REVALIDATE_SECONDS`)
- **API:** Next.js `unstable_cache(..., { tags: [PUBLIC_DATA_TAG], revalidate: 300 })`
- **Invalidation:** `invalidatePublicData()` calls `revalidateTag(PUBLIC_DATA_TAG, "max")` inside a try/catch. Outside a Next.js request/store (scripts/tests), invalidation is a no-op and the 300s backstop applies.
- **Write contract:** public-affecting server writes are wrapped with `withPublicInvalidation(write)`. Successful writes invalidate the shared tag; failed writes do not.

### Cached public readers

The shared tag currently covers:

- Tournament/public discovery: `listPublicTournaments`, `getPublicTournamentBySlug`, `getTournamentParticipants`, `getPublicDraw`, `getPublicTournamentsByOwner`, `listPublicTournamentSitemapEntries`.
- Public competition data: `getPublicFixtures`, `getPublicStandings`, `getPublicKnockout`, `getPublicMatch`.
- Archives/Hall/Rankings/Stats: `listArchive`, `listHallOfFame`, `getHallOfFameEntry`, `getPublicPlayerByGamerTag`, `readPlayerStatsMatches`, `getPlayerRatingCards`, `getPlayerHistory`, `getRankings`, `getHeadToHead`.
- Platform/public content: `getPublicPlatformSettings`, `getPublicAnnouncements`, `getBannerAnnouncements`, public player search API query, `getOrganiserProfile`.

### Mutation invalidation

Public invalidation is attached to successful writes that can affect public pages, including:

- Platform settings writes.
- Announcement create/update/publish/unpublish/delete.
- Tournament create/update/lifecycle, registration, draw, fixtures, matchday windows, images, results, knockout generation/results/deciders/reset/completion, standings recalc.
- Stats completion/recompute/refresh flows.
- Public profile/avatar and organiser profile/logo writes.
- Super-admin tournament suspension/unsuspension/ownership transfer.
- Result report create/resolve (admin-facing but shares tournament/public surfaces through status/attention patterns; invalidation is harmless).

### Accepted stale windows

- **Normal case:** public reads become stale for up to 300 seconds, or until the next request after a successful tagged invalidation.
- **Outside Next request store:** invalidation may be unavailable; the 300s backstop bounds staleness.
- **Request-dynamic layout:** the public layout still reads cookies/session-aware data (`getCurrentUser`, `SiteNotices`, and for signed-in users `getOwnProfile`/notification bell). This keeps pages request-dynamic at the layout level; data-level Firestore reads are reduced by the shared cache.
- **No real-time guarantee:** TTL deletion and cache invalidation are eventual at different layers. Public pages must tolerate short staleness; they must not expose private fields.

## Public page read-cost audit

Counts below are **Firestore document reads per cold cache miss/render** for the page's main data helpers, excluding session/auth/notification layout reads and excluding Next.js client assets. With the 300s shared cache, warm requests serve cached data and add ~0 Firestore reads for those cached helpers until invalidation/expiry.

| Public page                                                                   | Main cached data reads (cold)                                                                                                                                                                                                              | Notes                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `/`                                                                           | 1 query (`listPublicTournaments`, limit 9)                                                                                                                                                                                                 | Renders first 3 cards.                                                          |
| `/tournaments`                                                                | 1 query page (`listPublicTournaments`, limit 9)                                                                                                                                                                                            | Filters/search may change cache key.                                            |
| `/tournaments/[slug]`                                                         | ~6-8 reads typical: tournament by slug query (1), participants query (1), draw doc (1), fixtures+matchdays (2 queries), standings query (1), knockout ties+matches (2 queries), viewer registration (1, user-specific, not public-cached). | Heaviest public detail page; all public tournament datasets are cached by args. |
| `/tournaments/[slug]/knockout`                                                | 3 reads: tournament by slug (1), knockout ties (1), knockout matches (1).                                                                                                                                                                  | Shares knockout cache.                                                          |
| `/tournaments/[slug]/matches/[matchId]`                                       | 2 reads: tournament by slug (1), match doc (1).                                                                                                                                                                                            | Viewer is not used for cached public match read.                                |
| `/tournaments/[slug]/register`                                                | 1-2 reads: tournament by slug (1), viewer registration if signed in (1, user-specific).                                                                                                                                                    | Registration action is server-authoritative.                                    |
| `/players`                                                                    | 0 Firestore reads on initial HTML; search uses `/api/players/search`                                                                                                                                                                       | Search API is rate-limited and now caches by normalized prefix.                 |
| `/players/[gamerTag]`                                                         | 3 + N reads: public profile query (1), rating cards over configured games (G, currently 3), history query (1), stats match reads batched by 10 (`N = ceil(matchIds/10)`).                                                                  | Bounded by history limit (50) => at most 5 match batch reads.                   |
| `/players/compare`                                                            | 0-2 profile queries + optional head-to-head scan. Head-to-head scans up to 250 completed matches for player A and fetches up to 20 tournament docs for visible encounters.                                                                 | Expensive comparison is user-initiated and cached by normalized pair/page args. |
| `/rankings`                                                                   | 1 query page (limit 20)                                                                                                                                                                                                                    | Public cache key includes game/country/search/page/cursor.                      |
| `/archives`                                                                   | 3 status queries (`completed`, `archived`, `cancelled`)                                                                                                                                                                                    | In-memory merge/pagination after bounded status reads; cached.                  |
| `/hall-of-fame`                                                               | 1 query page (limit 12)                                                                                                                                                                                                                    | Cached.                                                                         |
| `/hall-of-fame/[id]`                                                          | 2 reads: hall-of-fame doc (1), knockout ties/matches if present (2)                                                                                                                                                                        | Knockout fetch reused/cached.                                                   |
| `/announcements`                                                              | 1 query page (limit 10 + small overread for expiry filter)                                                                                                                                                                                 | Cached by cursor.                                                               |
| `/organisers/[uid]`                                                           | 1 organiser profile doc + 1 public tournaments-by-owner query page                                                                                                                                                                         | Cached.                                                                         |
| `/about`, `/contact`, `/privacy`, `/terms`, `/organiser-code`, `/unsubscribe` | 0 Firestore public-data reads from GCC domain data                                                                                                                                                                                         | Static/legal/utility pages.                                                     |

## Read estimates

Assumptions:

- Cache window: 300s, 288 windows/day.
- Tag invalidation collapses repeated reads after writes, but estimate ignores invalidation benefit and uses worst-case window misses.
- Public layout/session reads are excluded because they depend on auth state and are not part of public Firestore content caching.
- "500 players" interpreted as active player profiles/catalog size; "5000 visitors" and "50k/day" interpreted as daily public traffic.

### Scenario A: 500 players, 5,000 visitors/day

| Traffic shape                                                                                                    | Estimated Firestore reads/day | Why                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------: | -------------------------------------------------------------------------------------------------------------------------- |
| Mostly home/tournaments/archives/rankings (1-3 cold reads/page type/window)                                      |                ~1,200 - 6,000 | 288 windows * ~4-20 cold page-type misses across the public surface.                                                       |
| Includes heavy detail views (tournament detail/player profile/compare) at 10% of page views, uncached worst case |              ~35,000 - 70,000 | 500 heavy views/day * ~70-140 reads if every view missed cache; with 300s cache this drops close to window-bounded misses. |
| Expected with shared cache                                                                                       |               ~3,000 - 15,000 | Most repeated reads hit `unstable_cache`; writes invalidate tag.                                                           |

### Scenario B: 50,000 visitors/day

| Traffic shape                                                                                  | Estimated Firestore reads/day | Why                                                                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------: | ------------------------------------------------------------------------------------------------- |
| Warm cache, same public surface                                                                |               ~3,000 - 20,000 | Cache misses are bounded by time windows, not visitor count, for identical public requests.       |
| High-cardinality traffic (many distinct tournament slugs, gamer tags, compare pairs, searches) |             ~30,000 - 120,000 | Distinct cache keys create cold misses; player compare and profile history are the main hotspots. |
| Pathological uncached worst case (no cache hits)                                               |                     ~350,000+ | 50,000 views * 7+ reads average. This is why public helpers must remain cached and bounded.       |

## Hotspots and guardrails

- **Tournament detail** is the heaviest public page. Keep its datasets independently cached and avoid adding uncached per-visitor queries.
- **Player compare/head-to-head** scans up to 250 completed matches for one participant; keep it user-initiated, paged, and cached by normalized pair/page.
- **Player profile history** can read up to 50 history docs and 5 match batches; acceptable for a profile view but should remain bounded.
- **Player search** is rate-limited and now cached by normalized query prefix; do not add unbounded scans.
- **Rules deny collection-group list queries** for `matches` and `registrations`. Server code must not add broad collection-group public reads; use tournament-scoped queries or Admin SDK server routes.

## Operational checklist

1. In Firebase Console, add TTL policy for collection group `rateLimits`, field `expiresAt`.
2. Do **not** add TTL for `announcements.expiresAt`.
3. After deploying public-read-affecting write paths, confirm `invalidatePublicData()` is called on success.
4. If a new public page/helper is added, either cache it with `cachePublicData(..., ["..."])` or document why it is intentionally uncached.
5. Keep `firestore.indexes.json` aligned with actual repo query shapes before deploying indexes.
