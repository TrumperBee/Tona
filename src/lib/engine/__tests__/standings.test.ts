// GCC - standings engine tests.
//
// The tests are split into hand-computed tables, one test per tie-break
// criterion (each proves the earlier criteria are tied), a worked example
// resolved by wins, and 1,000 seeded random result sets proving permutation
// invariance, idempotence, total order and the arithmetic invariants.
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "@/lib/engine/random";
import {
  assignBands,
  compareStandingRows,
  computeStandings,
  deriveLot,
  separatedByAbove,
  STANDING_BANDS,
  type StandingRow,
  type StandingRowBase,
  type StandingsMatch,
  type StandingsPlayer,
} from "@/lib/engine/standings";

function players(count: number): StandingsPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    lot: index + 1,
  }));
}

function match(
  id: string,
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number,
  matchday = 1,
): StandingsMatch {
  return { id, matchday, homeId, awayId, homeGoals, awayGoals };
}

function rowById(rows: readonly StandingRow[], id: string): StandingRow {
  const row = rows.find((candidate) => candidate.id === id);

  if (!row) {
    throw new Error(`Missing row for ${id}`);
  }

  return row;
}

function syntheticRow(overrides: Partial<StandingRowBase> = {}): StandingRowBase {
  return {
    id: "p",
    lot: 0,
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    awayGoals: 0,
    wins: 0,
    awayWins: 0,
    opponentPoints: 0,
    opponentGoalDifference: 0,
    opponentGoalsFor: 0,
    form: [],
    separatedBy: null,
    ...overrides,
  };
}

describe("hand-computed tables", () => {
  it("counts played, results, goals, away goals, points and form", () => {
    const rows = computeStandings({
      players: players(4),
      matches: [match("m1", "p0", "p1", 2, 0), match("m2", "p2", "p3", 1, 1, 2)],
    });

    const winner = rowById(rows, "p0");
    expect(winner).toMatchObject({
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      points: 3,
      awayGoals: 0,
      wins: 1,
      awayWins: 0,
      form: ["W"],
      position: 1,
      band: "direct",
    });

    const loser = rowById(rows, "p1");
    expect(loser).toMatchObject({
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      goalsFor: 0,
      goalsAgainst: 2,
      goalDifference: -2,
      points: 0,
      form: ["L"],
    });

    expect(rowById(rows, "p2")).toMatchObject({
      played: 1,
      drawn: 1,
      points: 1,
      goalsFor: 1,
      goalsAgainst: 1,
      form: ["D"],
    });
    expect(rowById(rows, "p3")).toMatchObject({ drawn: 1, points: 1, form: ["D"] });
  });

  it("keeps only the last five results, newest last", () => {
    const matches = [
      match("m1", "p1", "p0", 0, 1, 1),
      match("m2", "p0", "p1", 2, 0, 2),
      match("m3", "p1", "p0", 1, 1, 3),
      match("m4", "p0", "p1", 0, 3, 4),
      match("m5", "p1", "p0", 2, 2, 5),
      match("m6", "p0", "p1", 4, 0, 6),
    ];
    const rows = computeStandings({ players: players(2), matches });

    expect(rowById(rows, "p0").form).toEqual(["W", "D", "L", "D", "W"]);
    expect(rowById(rows, "p1").form).toEqual(["L", "D", "W", "D", "L"]);
  });

  it("orders a zero-match table by lot regardless of the player input order", () => {
    const input = players(36);
    const reversed = [...input].reverse();
    const shuffled = createSeededRandom("zero-match").shuffle(input);

    const first = computeStandings({ players: reversed, matches: [] });
    const second = computeStandings({ players: shuffled, matches: [] });

    expect(first).toHaveLength(36);
    expect(second).toEqual(first);
    expect(first.map((row) => row.position)).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
    expect(first.map((row) => row.lot)).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
    expect(first.every((row) => row.points === 0 && row.played === 0)).toBe(true);
    expect(first[0]?.separatedBy).toBeNull();
    expect(first.slice(1).every((row) => row.separatedBy === "lot")).toBe(true);
  });
});

describe("tie-break criteria", () => {
  it("criterion 1: points decide", () => {
    const a = syntheticRow({ id: "a", points: 3 });
    const b = syntheticRow({ id: "b", points: 1 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 2: goal difference decides when points are level", () => {
    const a = syntheticRow({ id: "a", points: 3, goalDifference: 2 });
    const b = syntheticRow({ id: "b", points: 3, goalDifference: 1 });

    expect(a.points).toBe(b.points);
    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 3: goals scored decide when points and goal difference are level", () => {
    const a = syntheticRow({ id: "a", points: 3, goalDifference: 1, goalsFor: 2 });
    const b = syntheticRow({ id: "b", points: 3, goalDifference: 1, goalsFor: 1 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 4: away goals decide when points, goal difference and goals are level", () => {
    const a = syntheticRow({
      id: "a",
      points: 3,
      goalDifference: 1,
      goalsFor: 2,
      awayGoals: 2,
    });
    const b = syntheticRow({
      id: "b",
      points: 3,
      goalDifference: 1,
      goalsFor: 2,
      awayGoals: 0,
    });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 5: wins decide when the first four criteria are level", () => {
    const a = syntheticRow({
      id: "a",
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 0,
      wins: 2,
    });
    const b = syntheticRow({
      id: "b",
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 0,
      wins: 1,
    });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 6: away wins decide when the first five criteria are level", () => {
    const a = syntheticRow({
      id: "a",
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 2,
      wins: 2,
      awayWins: 2,
    });
    const b = syntheticRow({
      id: "b",
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 2,
      wins: 2,
      awayWins: 1,
    });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 7: opponents' aggregate points decide", () => {
    const shared = {
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 2,
      wins: 2,
      awayWins: 1,
    } as const;
    const a = syntheticRow({ ...shared, id: "a", opponentPoints: 6 });
    const b = syntheticRow({ ...shared, id: "b", opponentPoints: 3 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 8: opponents' aggregate goal difference decides", () => {
    const shared = {
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 2,
      wins: 2,
      awayWins: 1,
      opponentPoints: 4,
    } as const;
    const a = syntheticRow({ ...shared, id: "a", opponentGoalDifference: 4 });
    const b = syntheticRow({ ...shared, id: "b", opponentGoalDifference: 1 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 9: opponents' aggregate goals scored decide", () => {
    const shared = {
      points: 6,
      goalDifference: 2,
      goalsFor: 2,
      awayGoals: 2,
      wins: 2,
      awayWins: 1,
      opponentPoints: 4,
      opponentGoalDifference: 4,
    } as const;
    const a = syntheticRow({ ...shared, id: "a", opponentGoalsFor: 8 });
    const b = syntheticRow({ ...shared, id: "b", opponentGoalsFor: 5 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
  });

  it("criterion 10: the lot is the final fallback", () => {
    const a = syntheticRow({ id: "a", lot: 1 });
    const b = syntheticRow({ id: "b", lot: 2 });

    expect(compareStandingRows(a, b, "uefa")).toBeLessThan(0);
    expect(compareStandingRows(b, a, "uefa")).toBeGreaterThan(0);
    expect(separatedByAbove(a, b, "uefa")).toBe("lot");
  });

  it("uses the classic profile order and ignores away/opponent criteria", () => {
    const a = syntheticRow({
      id: "a",
      lot: 2,
      points: 3,
      goalDifference: 1,
      goalsFor: 2,
      wins: 1,
      awayGoals: 0,
      opponentPoints: 0,
    });
    const b = syntheticRow({
      id: "b",
      lot: 1,
      points: 3,
      goalDifference: 1,
      goalsFor: 2,
      wins: 1,
      awayGoals: 5,
      opponentPoints: 9,
    });

    expect(compareStandingRows(a, b, "uefa")).toBeGreaterThan(0);
    expect(compareStandingRows(b, a, "classic")).toBeLessThan(0);
  });
});

describe("worked tie-break tables", () => {
  it("goal difference separates two winners with equal points", () => {
    const rows = computeStandings({
      players: players(4),
      matches: [match("m1", "p0", "p2", 2, 0), match("m2", "p1", "p3", 1, 0)],
    });

    expect(rowById(rows, "p0").position).toBeLessThan(rowById(rows, "p1").position);
    expect(rowById(rows, "p1").separatedBy).toBe("goalDifference");
  });

  it("goals scored separates two winners with equal points and goal difference", () => {
    const rows = computeStandings({
      players: players(4),
      matches: [match("m1", "p0", "p2", 2, 0), match("m2", "p1", "p3", 3, 1)],
    });

    expect(rowById(rows, "p1").goalsFor).toBe(3);
    expect(rowById(rows, "p0").goalDifference).toBe(2);
    expect(rowById(rows, "p1").position).toBeLessThan(rowById(rows, "p0").position);
    expect(rowById(rows, "p0").separatedBy).toBe("goalsFor");
  });

  it("away goals separate two winners with identical points, goal difference and goals", () => {
    const rows = computeStandings({
      players: players(4),
      matches: [match("m1", "p2", "p0", 1, 2), match("m2", "p1", "p3", 2, 1)],
    });

    expect(rowById(rows, "p0").awayGoals).toBe(2);
    expect(rowById(rows, "p1").awayGoals).toBe(0);
    expect(rowById(rows, "p0").position).toBeLessThan(rowById(rows, "p1").position);
    expect(rowById(rows, "p1").separatedBy).toBe("awayGoals");
  });

  it("wins separate a one-win team from a two-win team with identical points", () => {
    // A: 1 win + 3 draws = 6 pts, GF 2, GA 0, GD 2, away goals 0.
    // B: 2 wins = 6 pts, GF 2, GA 0, GD 2, away goals 0.
    // Criteria 1-4 are level; wins (criterion 5) put B above A.
    const rows = computeStandings({
      players: players(4),
      matches: [
        match("m1", "p0", "p2", 2, 0, 1),
        match("m2", "p1", "p2", 1, 0, 1),
        match("m3", "p1", "p3", 1, 0, 1),
        match("m4", "p0", "p3", 0, 0, 2),
        match("m5", "p2", "p0", 0, 0, 2),
        match("m6", "p3", "p0", 0, 0, 2),
      ],
    });

    const a = rowById(rows, "p0");
    const b = rowById(rows, "p1");

    expect(a).toMatchObject({
      played: 4,
      won: 1,
      drawn: 3,
      points: 6,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      awayGoals: 0,
      wins: 1,
      awayWins: 0,
    });
    expect(b).toMatchObject({
      played: 2,
      won: 2,
      drawn: 0,
      points: 6,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      awayGoals: 0,
      wins: 2,
      awayWins: 0,
    });
    expect(b.position).toBeLessThan(a.position);
    expect(a.separatedBy).toBe("wins");
  });

  it("away wins separate two one-win teams with identical records", () => {
    const rows = computeStandings({
      players: players(6),
      matches: [
        // A: away win 2-1, home 1-1, home 0-0, away 0-0.
        match("m1", "p2", "p0", 1, 2, 1),
        match("m2", "p0", "p3", 1, 1, 2),
        match("m3", "p0", "p4", 0, 0, 3),
        match("m4", "p5", "p0", 0, 0, 4),
        // B: home win 1-0, away 1-1, away 1-1, home 0-0.
        match("m5", "p1", "p2", 1, 0, 1),
        match("m6", "p3", "p1", 1, 1, 2),
        match("m7", "p4", "p1", 1, 1, 3),
        match("m8", "p1", "p5", 0, 0, 4),
      ],
    });

    const a = rowById(rows, "p0");
    const b = rowById(rows, "p1");

    expect(a).toMatchObject({
      points: 6,
      won: 1,
      drawn: 3,
      goalsFor: 3,
      goalsAgainst: 2,
      goalDifference: 1,
      awayGoals: 2,
      wins: 1,
      awayWins: 1,
    });
    expect(b).toMatchObject({
      points: 6,
      won: 1,
      drawn: 3,
      goalsFor: 3,
      goalsAgainst: 2,
      goalDifference: 1,
      awayGoals: 2,
      wins: 1,
      awayWins: 0,
    });
    expect(a.position).toBeLessThan(b.position);
    expect(b.separatedBy).toBe("awayWins");
  });

  it("opponents' aggregate points separate two teams with identical records", () => {
    const rows = computeStandings({
      players: players(5),
      matches: [
        match("m1", "p0", "p2", 1, 0, 1),
        match("m2", "p1", "p3", 1, 0, 1),
        match("m3", "p2", "p3", 1, 0, 2),
        match("m4", "p2", "p4", 2, 0, 3),
        match("m5", "p3", "p4", 1, 0, 4),
      ],
    });

    const a = rowById(rows, "p0");
    const b = rowById(rows, "p1");

    expect(rowById(rows, "p2").points).toBe(6);
    expect(rowById(rows, "p3").points).toBe(3);
    expect(a.points).toBe(3);
    expect(b.points).toBe(3);
    expect(a.goalDifference).toBe(1);
    expect(b.goalDifference).toBe(1);
    expect(a.wins).toBe(1);
    expect(b.wins).toBe(1);
    expect(a.opponentPoints).toBe(6);
    expect(b.opponentPoints).toBe(3);
    expect(a.position).toBeLessThan(b.position);
    expect(b.separatedBy).toBe("opponentPoints");
  });

  it("opponents' aggregate goal difference separates equal opponent points", () => {
    const rows = computeStandings({
      players: players(6),
      matches: [
        match("m1", "p0", "p2", 1, 0, 1),
        match("m2", "p1", "p3", 1, 0, 1),
        match("m3", "p2", "p4", 2, 0, 2),
        match("m4", "p5", "p2", 1, 0, 3),
        match("m5", "p3", "p4", 3, 0, 2),
        match("m6", "p5", "p3", 1, 0, 3),
      ],
    });

    const a = rowById(rows, "p0");
    const b = rowById(rows, "p1");

    expect(rowById(rows, "p2").points).toBe(3);
    expect(rowById(rows, "p3").points).toBe(3);
    expect(a.opponentPoints).toBe(3);
    expect(b.opponentPoints).toBe(3);
    expect(a.opponentGoalDifference).toBe(0);
    expect(b.opponentGoalDifference).toBe(1);
    expect(b.position).toBeLessThan(a.position);
    expect(a.separatedBy).toBe("opponentGoalDifference");
  });

  it("opponents' aggregate goals separate equal opponent points and goal difference", () => {
    const rows = computeStandings({
      players: players(6),
      matches: [
        match("m1", "p0", "p2", 1, 0, 1),
        match("m2", "p1", "p3", 1, 0, 1),
        match("m3", "p2", "p4", 3, 1, 2),
        match("m4", "p5", "p2", 1, 0, 3),
        match("m5", "p3", "p4", 4, 2, 2),
        match("m6", "p5", "p3", 1, 0, 3),
      ],
    });

    const a = rowById(rows, "p0");
    const b = rowById(rows, "p1");

    expect(a.opponentPoints).toBe(3);
    expect(b.opponentPoints).toBe(3);
    expect(a.opponentGoalDifference).toBe(0);
    expect(b.opponentGoalDifference).toBe(0);
    expect(a.opponentGoalsFor).toBe(3);
    expect(b.opponentGoalsFor).toBe(4);
    expect(b.position).toBeLessThan(a.position);
    expect(a.separatedBy).toBe("opponentGoalsFor");
  });
});

describe("qualification bands", () => {
  it("assigns 8 direct, 8 seeded, 8 unseeded and 12 eliminated positions", () => {
    const rows = Array.from({ length: 36 }, (_, index) =>
      syntheticRow({ id: `p${index}`, lot: index, position: index + 1 }),
    );
    const banded = assignBands(rows);

    expect(banded.filter((row) => row.band === "direct")).toHaveLength(8);
    expect(banded.filter((row) => row.band === "playoff_seeded")).toHaveLength(8);
    expect(banded.filter((row) => row.band === "playoff_unseeded")).toHaveLength(8);
    expect(banded.filter((row) => row.band === "eliminated")).toHaveLength(12);
    expect(banded[0]?.band).toBe("direct");
    expect(banded[8]?.band).toBe("playoff_seeded");
    expect(banded[16]?.band).toBe("playoff_unseeded");
    expect(banded[24]?.band).toBe("eliminated");
    expect(STANDING_BANDS).toEqual(["direct", "playoff_seeded", "playoff_unseeded", "eliminated"]);
  });
});

describe("deriveLot", () => {
  it("is deterministic, participant-specific and a safe integer", () => {
    const first = deriveLot("seed", "alice");
    const second = deriveLot("seed", "alice");

    expect(first).toBe(second);
    expect(Number.isSafeInteger(first)).toBe(true);
    expect(first).not.toBe(deriveLot("seed", "bob"));
    expect(first).not.toBe(deriveLot("other-seed", "alice"));
  });
});

describe("property checks over 1,000 random result sets", () => {
  it("is permutation-invariant, idempotent, strictly ordered and arithmetically sound", () => {
    const random = createSeededRandom("standings-property");
    const fieldSize = 36;
    const matchCount = 144;

    for (let run = 0; run < 1_000; run += 1) {
      const tablePlayers: StandingsPlayer[] = Array.from({ length: fieldSize }, (_, index) => ({
        id: `p${index}`,
        lot: index,
      }));
      const matches: StandingsMatch[] = [];

      for (let index = 0; index < matchCount; index += 1) {
        const home = random.nextInt(fieldSize);
        let away = random.nextInt(fieldSize);

        while (away === home) {
          away = random.nextInt(fieldSize);
        }

        matches.push({
          id: `m${String(index).padStart(3, "0")}`,
          matchday: Math.floor(index / 18) + 1,
          homeId: `p${home}`,
          awayId: `p${away}`,
          homeGoals: random.nextInt(6),
          awayGoals: random.nextInt(6),
        });
      }

      const rows = computeStandings({ players: tablePlayers, matches });
      const shuffled = computeStandings({
        players: random.shuffle(tablePlayers),
        matches: random.shuffle(matches),
      });
      const repeated = computeStandings({ players: tablePlayers, matches });

      expect(shuffled, `run ${run}`).toEqual(rows);
      expect(repeated, `run ${run}`).toEqual(rows);
      expect(
        rows.map((row) => row.position),
        `run ${run}`,
      ).toEqual(Array.from({ length: fieldSize }, (_, index) => index + 1));

      for (let index = 1; index < rows.length; index += 1) {
        expect(
          compareStandingRows(rows[index - 1]!, rows[index]!, "uefa"),
          `run ${run} order at ${index}`,
        ).toBeLessThan(0);
      }

      const decisive = matches.filter((entry) => entry.homeGoals !== entry.awayGoals).length;
      const draws = matches.length - decisive;
      expect(
        rows.reduce((total, row) => total + row.points, 0),
        `run ${run} points`,
      ).toBe(decisive * 3 + draws * 2);
      expect(
        rows.reduce((total, row) => total + row.goalsFor, 0),
        `run ${run} goals for`,
      ).toBe(rows.reduce((total, row) => total + row.goalsAgainst, 0));

      const stats = new Map<
        string,
        { played: number; points: number; goalDifference: number; goalsFor: number }
      >();

      for (const player of tablePlayers) {
        stats.set(player.id, { played: 0, points: 0, goalDifference: 0, goalsFor: 0 });
      }

      for (const entry of matches) {
        const home = stats.get(entry.homeId)!;
        const away = stats.get(entry.awayId)!;
        home.played += 1;
        away.played += 1;
        home.goalsFor += entry.homeGoals;
        away.goalsFor += entry.awayGoals;
        home.goalDifference += entry.homeGoals - entry.awayGoals;
        away.goalDifference += entry.awayGoals - entry.homeGoals;

        if (entry.homeGoals > entry.awayGoals) {
          home.points += 3;
        } else if (entry.homeGoals < entry.awayGoals) {
          away.points += 3;
        } else {
          home.points += 1;
          away.points += 1;
        }
      }

      for (const row of rows) {
        const expected = stats.get(row.id)!;
        expect(row.played, `run ${run} played ${row.id}`).toBe(expected.played);
        expect(row.points, `run ${run} points ${row.id}`).toBe(expected.points);
        expect(row.goalDifference, `run ${run} gd ${row.id}`).toBe(expected.goalDifference);

        const opponents = new Set<string>();

        for (const entry of matches) {
          if (entry.homeId === row.id) opponents.add(entry.awayId);
          if (entry.awayId === row.id) opponents.add(entry.homeId);
        }

        let opponentPoints = 0;
        let opponentGoalDifference = 0;
        let opponentGoalsFor = 0;

        for (const opponentId of opponents) {
          const opponent = stats.get(opponentId)!;
          opponentPoints += opponent.points;
          opponentGoalDifference += opponent.goalDifference;
          opponentGoalsFor += opponent.goalsFor;
        }

        expect(row.opponentPoints, `run ${run} opponent points ${row.id}`).toBe(opponentPoints);
        expect(row.opponentGoalDifference, `run ${run} opponent gd ${row.id}`).toBe(
          opponentGoalDifference,
        );
        expect(row.opponentGoalsFor, `run ${run} opponent gf ${row.id}`).toBe(opponentGoalsFor);
      }
    }
  }, 180_000);
});
