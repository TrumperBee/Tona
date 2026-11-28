# GCC Backup Restore Notes

This folder is produced by `npm run backup` (`scripts/ops/backup.ts`). It is a **free-plan Firestore export alternative**, not a managed point-in-time backup.

## What is exported

- `users.json` - user documents **without** password/private key fields. Firebase Auth passwords are not exportable by Admin SDK.
- `publicProfiles.json`
- `tournaments.json` and `tournaments/<id>/*.json` subcollections (`registrations`, `matches`, `standings`, `knockout`, `knockoutTies`, `events`, `draws`, `pots` where present)
- `rankings.json`
- `hallOfFame.json`
- `auditLogs.json`
- `announcements.json`
- `manifest.json` - project id, timestamp, counts

## What is NOT restorable as-is

- **Firebase Auth credentials/passwords**. Users may need password reset after an Auth restore/recreate.
- **Cloudinary assets**. URLs/public IDs may be in documents, but binaries live in Cloudinary.
- **Resend delivery state/suppressions outside Firestore** unless separately exported.
- **Exact Firestore internal metadata** (create/update internal tokens) except what is serialized.
- **Managed PITR guarantees**. This is a logical JSON export.

## Restore guidance

1. Restore only into the intended Firebase project after confirming project id.
2. Prefer managed Firestore backups/PITR on Blaze for production-grade recovery.
3. For logical restore, write a reviewed restore script that:
   - validates manifest project id;
   - restores Auth users separately (password reset required);
   - restores collections in dependency-safe order;
   - preserves IDs;
   - converts `__type: timestamp/date/ref` markers;
   - runs in emulator/staging first.
4. Do not restore directly into production without a dry run and operator approval.

## Safety

- `backups/` is gitignored.
- Backup exports may contain personal data; treat as sensitive and encrypt/store securely.
- Delete old local backups when no longer needed.
