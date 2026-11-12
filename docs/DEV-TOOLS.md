# GCC local dev tools

Development-only command-line helpers. Nothing in this document is deployed, exposed through an
API route, or reachable from the browser.

## Test-player seeder

`npm run dev:seed` creates fictional player accounts and registers them into an existing
tournament using the **real** server services:

- `registerPlayer` from `src/lib/auth/registration.ts` (Auth user + tag reservation + private
  public profile in one transaction, with rollback).
- `registerPlayerForUser` from `src/lib/tournament/registrations.ts` (the same registration
  transaction the player route uses: effective state, restrictions, 36-player cap, membership,
  counters, notifications and audit log).

The script adds no business rules of its own. Rate limits and same-origin checks stay in the HTTP
route layer and are intentionally not used locally.

`tsx` is the only added dependency: it runs the TypeScript CLI directly (`tsx --tsconfig
scripts/dev/tsconfig.json ...`) without adding a build step or changing the Next.js app config.
The script tsconfig maps `server-only` to a no-op shim so server modules can run in plain Node.
That mapping is scoped to `scripts/dev/`; production keeps the real guard.

### Requirements

- Node 24 (`process.loadEnvFile` is built in; `dotenv` is not used).
- `.env.local` with the Firebase Admin credentials (`FIREBASE_ADMIN_PROJECT_ID`,
  `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`).
- The target tournament must already exist and its **effective registration state must be `open`**.
  The seeder never publishes a tournament, changes dates, opens registration, or edits settings.

## Commands

```bash
npm run dev:seed -- list
npm run dev:seed -- players --tournament <slug> --fill
npm run dev:seed -- players --tournament <slug> --count 12
npm run dev:seed -- status
npm run dev:seed -- cleanup
npm run dev:seed -- cleanup --tournament <slug>
npm run dev:seed -- cleanup --tournament <slug> --execute
npm run dev:seed -- cleanup --tournament <slug> --delete-tournament --execute
```

### `list`

Read-only. Shows every tournament's slug, name, stored status, `registrationCount / capacity`, and
the effective registration state. No confirmation is required.

### `players --tournament <slug> --fill`

Adds test players until exactly `capacity` (36) **total registrations** exist. The count includes
real players already in the field. For example, with 2 real registrations it creates/registers
exactly 34 test players.

### `players --tournament <slug> --count N`

Registers exactly `N` test players in the tournament; it does not count real players. Existing
manifest accounts are reused first, and only missing accounts/registrations are created. Re-running
the same command is a no-op. `N` must be between 1 and 36, and the total field capacity is always
enforced by the production registration transaction.

Both modes:

- Print a plan (project id, tournament, owner, counts, candidate tags) first.
- Require typing the Firebase project id. There is no `--yes`.
- Never create more than 36 test accounts in total, and never mutate an existing test account.
- Skip candidate tags already owned by a real account and move to the next candidate.

### `status`

Read-only. Shows the manifest batch, how many accounts still exist in Firebase Auth, and in which
tournaments those accounts have registrations. The batch password is **not** printed; it is stored
in `.seed/manifest.json`.

### `cleanup` (dry run by default)

Without `--execute`, prints the full cleanup plan and writes nothing.

With `--tournament <slug>`, only that tournament is considered. Without it, every tournament with
test registrations is considered.

Cleanup only ever touches accounts that are:

1. present in `.seed/manifest.json`, and
2. on the reserved `@gcc-test.example` domain, and
3. not the configured Super Admin.

For each manifest account with no registration outside the cleaned scope it deletes:

- the Firebase Auth user,
- `users/{uid}` recursively (including notifications and memberships),
- `publicProfiles/{uid}` recursively,
- the `gamerTags/{lowercase}` reservation **only if it still belongs to that uid**,
- the test registration document(s), plus the matching membership document.

For a tournament still in `draft`, `registration_open` or `registration_closed` with no draw,
fixture draft, matches, matchdays, standings, result reports or knockout ties, the test
registrations are removed and `registrationCount` is corrected in the same transaction.

If the tournament has progressed further, partial cleanup is refused. The only allowed path is:

```bash
npm run dev:seed -- cleanup --tournament <slug> --delete-tournament --execute
```

That recursively deletes the entire tournament document and all of its subcollections, deletes its
`tournamentSlugs/{slug}` reservation, and then removes manifest accounts that have no remaining
registrations elsewhere. It prints an explicit extra warning and asks you to type the tournament
slug after typing the project id.

Audit logs, organisers, the Super Admin and unrelated data are never deleted.

## Safety model

- **Environment refusal:** `NODE_ENV=production` is always refused. A project id that looks like an
  emulator/demo project (`demo-*`, `emulator-*`, `fake-*`, `*-emulator`) is refused unless
  `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST` is set.
- **Typed confirmation:** every write prints its plan and requires the exact Firebase project id.
  Full tournament deletion also requires the slug. Empty input, `yes`, or any mismatch aborts
  before the first write.
- **Manifest scope:** accounts live in `.seed/manifest.json` with batch id, createdAt, project id,
  uid, gamerTag, email and the shared batch password. `.seed/` is git-ignored. If the manifest is
  lost, this tool cannot identify those accounts for cleanup anymore.
- **No secrets in logs:** `.seed/seed.log` is append-only structured JSON. Passwords, tokens and
  private keys are redacted defensively; passwords are never printed to the console.
- **Read-only on failure paths:** a refused confirmation, closed registration state, project
  mismatch or progressed tournament aborts before writing.

## Fake player data

- Deterministic, valid gamer tags covering 3 and 16 characters, mixed case, `_ . -`, digit-prefixed
  tags and long stress tags. Reserved platform names are excluded. Duplicate tags are skipped.
- Emails are `testplayerNN@gcc-test.example`. This is not a real domain; never change it to a real
  address.
- One random batch password per manifest batch (>= 12 characters), shared by the batch so you can
  sign in as any test player.
- WhatsApp numbers are exclusively UK Ofcom drama numbers in `+44 7700 900NNN` (stored E.164), so
  nobody can ever be contacted. The production phone validator correctly treats this reserved range
  as non-dialable, so the seeder stores the reserved value directly on the freshly created test
  account instead of weakening that validation.
- Fictional names, varied countries (roughly half Kenya), games and platforms. Country/platform
  values are adjusted when the tournament has entry restrictions.
- No avatars or uploaded images, so the initials fallback is exercised.

## Warnings

These accounts are created in the **real Firebase project configured in `.env.local`**. Until you
clean them up they can appear in public player search and leaderboards. Always dry-run cleanup
first. Never use a real person's name, email address or phone number, and never point this tool at a
production database that contains real users unless you intend to add test data to it.
