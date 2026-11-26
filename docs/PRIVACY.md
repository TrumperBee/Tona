# Account deletion policy (Phase 18A)

Public-facing copy lives in `src/app/(public)/privacy/page.tsx`. This note records the
engineering decisions behind it.

## Chosen policy

- **Keep history.** Completed matches, tournament history, standings, Hall of Fame entries
  and registration records stay under the player's existing gamer tag. That gamer tag
  reservation is deliberately **not released**, so nobody can reuse the identity or take
  over the record.
- **Anonymise the public profile.** `publicProfiles/{uid}` becomes `Deleted player` with no
  avatar, no community, no favourite club and no other personal display text. The public
  profile page shows a neutral placeholder; compare and player search exclude it.
- **No silent release.** Tournament entries keep their `registered` status and count towards
  the field. Organisers see `Deleted player` in registration lists and exports. No fixture,
  pot, draw or result is rewritten or removed.

## Removed at the player's request

Firebase Auth user; private `email`, `fullName`, `whatsappE164`, `community`,
`favouriteClub`, `photoUrl`, `avatarUrl` and `avatarPublicId`; public avatar and optional
display text. Cloudinary avatar deletion is attempted with the stored public id; if the
provider is unavailable, the database reference is still cleared and the audit entry records
whether cleanup was attempted.

## Guardrails

- Server-enforced fresh sign-in (10 minutes), same-origin check and a per-user
  Firestore fixed-window limit of three deletion attempts per hour.
- The configured Super Admin and any account with a `super_admin` claim cannot self-delete.
- Organisers owning any non-terminal tournament (draft, registration, suspended, in play)
  are blocked until it is completed, archived, cancelled or transferred.
- Every successful deletion is appended to `auditLogs` under `user.account.deleted`, with no
  email, name or phone number in the entry.

## Accepted risks

- Cloudinary cleanup is best effort; a provider outage can leave an unreferenced asset.
- If the append-only audit write fails after the irreversible Auth deletion, the route returns
  an error even though the account is gone. Operators can correlate the Firestore deletion
  marker with request logs.
- Deleted accounts remain countable in historical statistics by uid; only display-facing
  public fields are anonymised.
