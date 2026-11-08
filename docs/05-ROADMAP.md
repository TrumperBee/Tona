# GCC — Roadmap

> Phases 1, 1B, 2, 3, 3B and 4 are done. Phase 4 delivered real registration,
> email verification, sign-in, password reset, player profiles, avatar upload and
> public player search. A phase starts only when the previous phase is reviewed
> and accepted.

| #   | Phase                                              | Primary deliverables                                                                                                     | Status      |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1   | Scaffold                                           | Project structure, configuration, design tokens, docs, public shell, health check                                        | Done        |
| 1B  | Firebase                                           | Remove the previous database stack, Firebase Auth + Firestore, Admin SDK, deny-all rules, emulator config, update docs   | Done        |
| 2   | Data model, rules and auth                         | Firestore collections, Security Rules (read-only), indexes, Auth session cookies, custom claims, guards, Admin SDK types | Done        |
| 3   | Design system                                      | Brand identity, home page, about/contact/legal pages, public discovery shell                                             | Done        |
| 3B  | Patch                                              | Admin-only results, result reports, profile stats/history, redirect and same-origin hardening, security headers, CI/docs | Done        |
| 4   | Accounts and profiles                              | Sign-up, email verification, sign-in, password reset, profiles, avatars                                                  | Done        |
| 5   | Super Admin dashboard                              | Platform overview, users, tournaments, analytics, settings, audit log viewer                                             | Not started |
| 6   | Organiser application and approval                 | Application form, review queue, approval/rejection with audit entries                                                    | Not started |
| 7   | Organiser dashboard                                | Organiser shell, owned-tournament management, ownership guards                                                           | Not started |
| 8   | Tournament creation and registration               | Create/edit/publish tournaments, registrations, participant lists                                                        | Not started |
| 9   | Pot allocation (manual + shuffle)                  | Plain pots (no country restrictions), seeded draw, admin shuffle, audit trail                                            | Not started |
| 10  | Fixture engine                                     | Pure constraint-based generator, validator, matchdays, fixture UI                                                        | Not started |
| 11  | Admin result entry, corrections and result reports | Admin-only score entry, corrections with reason and audit, player "Report a problem" channel                             | Not started |
| 12  | Standings                                          | Pure standings calculation, tiebreakers, snapshots, qualification bands                                                  | Not started |
| 13  | Knockout stages                                    | Play-off pairings, bracket, progression, final                                                                           | Not started |
| 14  | WhatsApp contact                                   | E.164 handling, templates, click-to-chat links, reminders                                                                | Not started |
| 15  | Graphics                                           | HTML/SVG templates for fixtures, results, standings, shareable profile card; PNG export                                  | Not started |
| 16  | Notifications and email                            | In-app notifications, announcements, email delivery preferences                                                          | Not started |
| 17  | Stats, ratings, rankings, Hall of Fame             | Career stats, ratings, rankings, archives, champions, Hall of Fame                                                       | Not started |
| 18  | Security audit, CSP, App Check, deployment         | Security review, CSP, App Check, rules and E2E tests, performance, backups, production deployment                        | Not started |

## Milestones

- **Foundation (1–3B):** a secure, validated project, data model, auth infrastructure and public site.
- **Public launch (4–5):** accounts, player profiles and the owner dashboard.
- **Organising (6–10):** admins, tournaments, registration, pots and fixtures.
- **Competition (11–13):** admin result entry, result reports, standings and knockouts.
- **Experience (14–17):** communication, graphics, notifications, statistics and history.
- **Production (18):** security audit, CSP, App Check, testing and deployment.

## Phase exit rule

A phase is complete only when:

1. Its acceptance checks pass (lint, typecheck, tests, build, and a manual smoke test).
2. Documentation is updated.
3. No fake data, dead controls or placeholder features are presented as working.
4. Security implications are reviewed against `docs/04-SECURITY.md`.
