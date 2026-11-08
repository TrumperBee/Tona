# GCC — Competition Engine

> **Status: design in Phase 10.**
>
> `src/lib/engine/` currently contains pure domain types and documented stubs. No fixture
> generation, standings calculation or knockout logic is implemented in Phase 1. Phase 9
> implements pot allocation; Phase 10 implements fixtures; Phase 12 standings; Phase 13
> knockouts.

## 1. Principles

- **Pure TypeScript.** No database, Firebase, Next.js or environment imports. No I/O, no
  `Date.now()` inside deterministic calculations, no hidden randomness.
- **Data in, data out.** The engine receives participants, pots, format configuration,
  results and a seed; it returns fixtures, validation reports, standings and
  qualification.
- **Deterministic and reproducible.** Given the same inputs and seed, output is identical.
  Randomised draws record the seed and the generated output so a draw can be audited.
- **Independent validation.** Generation and validation are separate functions. A
  schedule is stored only after validation passes.
- **Server-only invocation.** The engine is imported by trusted server code and unit
  tests, never trusted to run from client input.

## 2. Inputs and outputs

### Fixture generation

Inputs:

- 36 participants assigned to four pots of nine.
- Format constraints: 8 matches per participant, 2 opponents per pot, 4 home / 4 away,
  8 matchdays, 144 matches total.
- A recorded seed.

Outputs:

- 144 fixtures with matchday, home participant, away participant.
- A validation report.
- A record of the seed and constraint set used.

### Standings

Inputs:

- Participants.
- Fixtures.
- **Completed** results only. Results are entered by the tournament owner or Super Admin;
  players never submit or confirm a score.
- Format tiebreak order.

Outputs:

- Ordered table with played, won, drawn, lost, goals for/against, goal difference, points.
- Qualification outcome per participant derived from format bands.

## 3. Fixture constraints (launch format)

Every generated schedule must satisfy:

1. Exactly 36 participants, four pots of nine.
2. Exactly 144 matches, 18 per matchday, 8 matchdays.
3. Every participant plays exactly 8 matches and appears exactly once per matchday.
4. Every participant faces exactly 2 opponents from each pot.
5. No participant faces the same opponent twice.
6. Every participant has exactly 4 home and 4 away matches.
7. No participant is drawn against itself.
8. Matchdays are balanced: every participant appears once per matchday (implied by 3 + 4).
9. Optionally, home/away alternation should avoid long runs of the same venue where the
   constraints allow it.

## 4. Generation approach (planned)

1. **Constrain the graph.** Model the schedule as a graph problem: each participant needs
   degree 8, with pot quotas and a home/away split.
2. **Build pairings.** Generate legal pairings per participant and pot without duplication,
   using a seeded pseudo-random generator.
3. **Colour into matchdays.** Assign each participant's eight matches to eight matchdays so
   each participant appears exactly once per matchday (an edge-colouring problem).
4. **Orient home/away.** Assign four home and four away matches per participant while
   respecting the venue balance.
5. **Retry with a new deterministic attempt.** If a constraint fails, retry with the seed
   advanced rather than relaxing the rules.
6. **Validate independently.** Run `validate.ts`; persist only if every constraint passes.
7. **Record the audit trail.** Store seed, attempt number and validation report.

The engine must fail loudly rather than publish an invalid schedule.

## 5. Standings and tiebreakers

- Points: win = 3, draw = 1, loss = 0.
- Only completed results affect standings. Unplayed or corrected results are never inferred
  from client input.
- Ordering plan:
  1. Points
  2. Goal difference
  3. Goals scored
  4. Head-to-head points among tied participants
  5. Head-to-head goal difference
  6. Number of away goals scored
  7. Number of wins
  8. Deterministic final tiebreak (documented; no silent alphabet fallback)

The exact order is confirmed with the format definition in Phase 12 and documented here
before implementation. Tiebreak logic must be a pure, tested comparator with a stable
result.

## 6. Qualification bands

Positions are mapped using the format definition, not `if` statements:

| Positions | Outcome            |
| --------- | ------------------ |
| 1–8       | Round of 16        |
| 9–16      | Seeded play-offs   |
| 17–24     | Unseeded play-offs |
| 25–36     | Eliminated         |

Play-offs pair seeded teams with unseeded teams. Play-off winners join the eight direct
qualifiers to form the Round of 16.

## 7. Test plan (Phase 10+)

- Property tests: for many seeds, all constraints hold.
- Determinism: same seed and inputs produce identical output.
- Negative tests: tampered schedules fail validation for every rule.
- Pot quotas: each participant's opponent count per pot equals 2.
- Home/away: every participant has 4 and 4.
- Matchday coverage: 36 distinct participants per matchday.
- Standings: only confirmed results count; ordering is stable under ties.
- Qualification: band boundaries (8/9, 16/17, 24/25) map correctly.
- Knockout: bracket progression and winner propagation.

## 8. Interface discipline

The engine may depend on its own `types.ts` and on plain configuration objects passed in.
It must not import from `src/lib/firebase`, `next/*`, `react` or `process.env`. This is
enforced by review and, from Phase 18, by a lint rule.
