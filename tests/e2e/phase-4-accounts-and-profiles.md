# Phase 4 manual acceptance script — accounts and profiles

Run this script against **either** a local emulator stack or a real Firebase project.
Record which environment you used; the two are not interchangeable evidence.

## 0. Environment

### Option A — local emulators (no production data)

```bash
# Terminal 1
npm run emulators

# Terminal 2 — point the app at the emulators
# .env.local: set NEXT_PUBLIC_FIREBASE_* to the emulator values, or use the
# Firebase demo project. Then:
npm run dev
```

The Auth emulator's email links are printed to the emulator terminal; open them
from there instead of waiting for real mail.

### Option B — real Firebase project

1. Copy the real `FIREBASE_ADMIN_*` and `NEXT_PUBLIC_FIREBASE_*` values into
   `.env.local`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for local
   testing.
2. In Firebase Console → Authentication → Settings → Authorized domains, make
   sure `localhost` is present.
3. `npm run dev`.

Before testing, confirm no fake data exists: `users`, `publicProfiles` and
`gamerTags` should only contain accounts you create below.

## 1. Registration

- [ ] Open `/register`. The form renders with full name, email, password,
      confirm password, gamer tag, game, platform, country and optional WhatsApp.
- [ ] Enter a gamer tag with 2 characters → inline validation rejects it.
- [ ] Enter `admin` → rejected as reserved.
- [ ] Enter `Player_01` twice with different casing (`player_01`) in two browser
      profiles → only one account can be created; the other sees “already taken”.
- [ ] Enter an invalid WhatsApp number (e.g. `123`) → inline error; no account is
      created.
- [ ] Enter mismatched passwords → client rejects before submitting.
- [ ] Create a valid account. You land on `/verify-email`.
- [ ] Check Firestore:
  - [ ] `users/{uid}` exists with `gamerTag`, `gamerTagLower`, `email`,
        `whatsappE164` (E.164 or null), `role: "user"`, `status: "active"`.
  - [ ] `publicProfiles/{uid}` exists with zeroed `stats` and **no email or
        WhatsApp field**.
  - [ ] `gamerTags/{gamerTagLower}` exists and maps to the uid.
- [ ] In Firebase Authentication, the new user is **not** verified and has **no**
      `role` custom claim yet.

## 2. Email verification

- [ ] On `/verify-email`, press “Resend email”. The button enters a 60-second
      cooldown and a second press is disabled.
- [ ] Open the verification link (emulator terminal or real inbox).
- [ ] Return to `/verify-email`, press “I've verified”. You are sent to
      `/dashboard`.
- [ ] While unverified, `/dashboard` and `/dashboard/profile` still render and
      show the verification banner. Tournament entry is not yet available.

## 3. Sign-in and sign-out

- [ ] Sign out. `/dashboard` redirects to `/login?next=…`.
- [ ] Sign in with a wrong password → generic “Email or password is incorrect.”
- [ ] Sign in with an unknown email → the **same** generic message.
- [ ] Sign in correctly and confirm you return to the requested page.
- [ ] Try `/login?next=https://evil.example` → after sign-in you stay on a local
      dashboard, never the external site.
- [ ] Sign out; the session cookie and Firebase client session are both cleared.

## 4. Password reset

- [ ] Open `/forgot-password`, submit a known address and an unknown address.
      Both show the identical “If an account exists…” message.
- [ ] Open the reset link, set a new password, sign in with it.

## 5. Profile

- [ ] `/dashboard/profile` shows the real gamer tag, country, game, platform and
      zeroed statistics; win rate reads “—” and rank reads “Unranked”.
- [ ] No sample matches, fake wins or fabricated history appear.
- [ ] “Edit profile” opens `/dashboard/profile/edit`.
- [ ] Change full name, community, favourite club, country, game, platform and
      WhatsApp; save. The profile page reflects the changes.
- [ ] Confirm the gamer tag and email cannot be edited anywhere.
- [ ] Confirm `users/{uid}.whatsappE164` is stored in E.164 and the public
      profile still has no WhatsApp field.
- [ ] Set WhatsApp blank; save. `whatsappE164` becomes null.

## 6. Avatar

- [ ] Upload a JPEG, a PNG and a WebP. Each is cropped to a square and uploaded.
      The avatar appears on the profile, dashboard header and public profile.
- [ ] Upload a file that is not an image (e.g. rename a `.txt` to `.jpg`). The
      server rejects it with a format error.
- [ ] Upload an image over 1 MB after client compression is bypassed (e.g. via a
      direct API call). The server returns 413.
- [ ] Inspect `avatarUrl`: it is a Cloudinary `res.cloudinary.com/.../gcc/avatars/{uid}`
      URL with `f_auto,q_auto`, and was built by the server (the client never
      sends a URL).
- [ ] Remove the avatar. Both documents clear `avatarUrl`/`avatarPublicId` and
      the Cloudinary asset is deleted.
- [ ] With Cloudinary env vars unset, `POST /api/profile/avatar` returns 503 with
      a configuration message, while the rest of the profile still works.

## 7. Public profiles and search

- [ ] `/players` renders the search box and no invented players.
- [ ] Type 1 character → no request runs; the hint explains the 2-character
      minimum.
- [ ] Type a real gamer-tag prefix → matching profiles appear (max 20).
- [ ] Open a result → `/players/{gamerTag}` shows only public data: tag, country,
      game, platform, community, favourite club, avatar and zeroed record. No
      email, WhatsApp number or role.
- [ ] Request a non-existent tag → branded 404.
- [ ] Suspend the account in the Firebase console / Admin SDK, then reload the
      public profile → “Profile unavailable”, not the data.
- [ ] Fire many searches quickly → the 429 message appears.

## 8. Security spot checks

- [ ] `POST /api/auth/register`, `PATCH /api/profile`, `POST /api/profile/avatar`
      and `DELETE /api/profile/avatar`:
  - [ ] without a session cookie → 401;
  - [ ] with a cross-origin `Origin` → 403;
  - [ ] with `role`, `avatarUrl`, `stats` or `gamerTag` in a profile PATCH body →
        400 (strict schema).
- [ ] Firestore rules still deny every client write (re-run
      `npm run test:rules`).
- [ ] Server logs contain no password, ID token, session cookie or WhatsApp
      number.
- [ ] Search the client bundle for `FIREBASE_ADMIN`, `CLOUDINARY_API_SECRET` and
      `SUPER_ADMIN_EMAIL` → no matches.

## 9. Automated checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:integration
npm run build
npm run format:check
```

Lighthouse (production build, local server): `/register`, `/login` and
`/dashboard/profile`. Record the four category scores and note that local
Lighthouse results vary by machine.
