# GCC — Roadmap

> Phases 1, 1B and 2 are done. Phase 2 implements the Firestore data model, Security
> Rules, rules tests and server auth infrastructure. Phases 4–18 keep their earlier scope;
> the final phase list will be confirmed by the product owner. A phase starts only when the
> previous phase is reviewed and accepted.

| #   | Phase                                             | Primary deliverables                                                                                                     | Status      |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1   | Product architecture and scaffold                 | Project structure, configuration, design tokens, docs, public shell, health check                                        | Done        |
| 1B  | Firebase migration                                | Remove the previous database stack, Firebase Auth + Firestore, Admin SDK, deny-all rules, emulator config, update docs   | Done        |
| 2   | Data model, rules and auth infrastructure         | Firestore collections, Security Rules (read-only), indexes, Auth session cookies, custom claims, guards, Admin SDK types | Done        |
| 3   | Design system and public skeleton                 | Brand identity, home page, about/contact/legal pages, public discovery shell                                             | Not started |
| 4   | User registration and player profiles             | Sign-up, email verification, sign-in, password reset, profiles                                                           | Not started |
| 5   | Super administrator dashboard                     | Platform overview, users, tournaments, analytics, settings, audit log viewer                                             | Not started |
| 6   | Tournament administrator application and approval | Application form, review queue, approval/rejection with audit entries                                                    | Not started |
| 7   | Tournament administrator dashboard                | Organiser shell, owned-tournament management, ownership guards                                                           | Not started |
| 8   | Tournament creation and participant registration  | Create/edit/publish tournaments, registrations, participant lists                                                        | Not started |
| 9   | Four-pot allocation                               | Plain pots (no country restrictions), seeded draw, admin shuffle, audit trail                                            | Not started |
| 10  | Fixture-generation engine                         | Pure constraint-based generator, validator, matchdays, fixture UI                                                        | Not started |
| 11  | Match result submission and verification          | Provisional submissions, evidence, admin confirmation, disputes, audit                                                   | Not started |
| 12  | Automatic league standings                        | Pure standings calculation, tiebreakers, snapshots, qualification bands                                                  | Not started |
| 13  | Knockout stages                                   | Play-off pairings, bracket, progression, final                                                                           | Not started |
| 14  | WhatsApp communication system                     | E.164 handling, templates, click-to-chat links, reminders                                                                | Not started |
| 15  | Automatic graphics generation                     | HTML/SVG templates for fixtures, results, standings; PNG export                                                          | Not started |
| 16  | Notifications and announcements                   | In-app notifications, announcements, delivery preferences                                                                | Not started |
| 17  | Player statistics and Hall of Fame                | Career stats, rankings, archives, champions, Hall of Fame                                                                | Not started |
| 18  | Security testing, optimisation and deployment     | Security review, rules and E2E tests, performance, backups, production deployment                                        | Not started |

## Milestones

- **Foundation (1–2):** a secure, validated project, data model and auth infrastructure.
- **Public launch (3–5):** brand, website, accounts and the owner dashboard.
- **Organising (6–10):** admins, tournaments, registration, pots and fixtures.
- **Competition (11–13):** results, standings and knockouts.
- **Experience (14–17):** communication, graphics, notifications and history.
- **Production (18):** hardening, testing and deployment.

## Phase exit rule

A phase is complete only when:

1. Its acceptance checks pass (lint, typecheck, tests, build, and a manual smoke test).
2. Documentation is updated.
3. No fake data, dead controls or placeholder features are presented as working.
4. Security implications are reviewed against `docs/04-SECURITY.md`.
