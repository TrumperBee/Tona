// GCC - league table calculation from recorded results.
//
// PURE TypeScript. The caller supplies every player and every completed league
// match. Nothing is inferred, no scores are invented and no manual table row is
// accepted. Matches are processed in a deterministic order (matchday, then id)
// so shuffling the input array cannot change form or any other value.
import { assignBands, compareStandingRows, separatedByAbove } from "./tiebreakers";
import {
  DEFAULT_TIEBREAKER_PROFILE,
  type ComputeStandingsInput,
  type StandingRow,
  type StandingRowBase,
  type StandingsForm,
  type StandingsMatch,
} from "./types";

interface MutableStats {
  readonly id: string;
  readonly lot: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  awayGoals: number;
  awayWins: number;
  form: StandingsForm[];
  opponents: Set<string>;
}

function emptyStats(id: string, lot: number): MutableStats {
  return {
    id,
    lot,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    awayGoals: 0,
    awayWins: 0,
    form: [],
    opponents: new Set<string>(),
  };
}

function compareMatches(a: StandingsMatch, b: StandingsMatch): number {
  const matchday = (a.matchday ?? 0) - (b.matchday ?? 0);

  if (matchday !== 0) {
    return matchday;
  }

  if (a.id < b.id) {
    return -1;
  }

  if (a.id > b.id) {
    return 1;
  }

  return 0;
}

function assertScore(value: number, matchId: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Match ${matchId} has an invalid score. Scores must be non-negative whole numbers.`,
    );
  }
}

function recordResult(
  stats: MutableStats,
  outcome: StandingsForm,
  goalsFor: number,
  goalsAgainst: number,
  isAway: boolean,
): void {
  stats.played += 1;
  stats.goalsFor += goalsFor;
  stats.goalsAgainst += goalsAgainst;
  stats.form.push(outcome);

  if (isAway) {
    stats.awayGoals += goalsFor;
  }

  if (outcome === "W") {
    stats.won += 1;

    if (isAway) {
      stats.awayWins += 1;
    }
  } else if (outcome === "D") {
    stats.drawn += 1;
  } else {
    stats.lost += 1;
  }
}

/**
 * Computes the table from scratch. The returned rows are positioned 1..N,
 * carry their qualification band and are a strict total order for the selected
 * profile. When there are no matches every row is zero and the order is lot
 * ascending, which proves the fallback is independent of input order.
 */
export function computeStandings(input: ComputeStandingsInput): readonly StandingRow[] {
  const profile = input.profile ?? DEFAULT_TIEBREAKER_PROFILE;
  const stats = new Map<string, MutableStats>();

  for (const player of input.players) {
    if (stats.has(player.id)) {
      throw new Error(`Duplicate player id in standings input: ${player.id}`);
    }

    stats.set(player.id, emptyStats(player.id, player.lot));
  }

  const matches = [...input.matches].sort(compareMatches);

  for (const match of matches) {
    assertScore(match.homeGoals, match.id);
    assertScore(match.awayGoals, match.id);

    if (match.homeId === match.awayId) {
      throw new Error(`Match ${match.id} cannot be played by the same participant twice.`);
    }

    const home = stats.get(match.homeId);
    const away = stats.get(match.awayId);

    if (!home || !away) {
      throw new Error(`Match ${match.id} references a participant outside the player list.`);
    }

    home.opponents.add(match.awayId);
    away.opponents.add(match.homeId);

    if (match.homeGoals > match.awayGoals) {
      recordResult(home, "W", match.homeGoals, match.awayGoals, false);
      recordResult(away, "L", match.awayGoals, match.homeGoals, true);
    } else if (match.homeGoals < match.awayGoals) {
      recordResult(home, "L", match.homeGoals, match.awayGoals, false);
      recordResult(away, "W", match.awayGoals, match.homeGoals, true);
    } else {
      recordResult(home, "D", match.homeGoals, match.awayGoals, false);
      recordResult(away, "D", match.awayGoals, match.homeGoals, true);
    }
  }

  const rows: StandingRowBase[] = [...stats.values()].map((entry) => {
    const goalDifference = entry.goalsFor - entry.goalsAgainst;
    let opponentPoints = 0;
    let opponentGoalDifference = 0;
    let opponentGoalsFor = 0;

    for (const opponentId of entry.opponents) {
      const opponent = stats.get(opponentId);

      if (!opponent) {
        continue;
      }

      opponentPoints += opponent.won * 3 + opponent.drawn;
      opponentGoalDifference += opponent.goalsFor - opponent.goalsAgainst;
      opponentGoalsFor += opponent.goalsFor;
    }

    return {
      id: entry.id,
      lot: entry.lot,
      position: 0,
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference,
      points: entry.won * 3 + entry.drawn,
      awayGoals: entry.awayGoals,
      wins: entry.won,
      awayWins: entry.awayWins,
      opponentPoints,
      opponentGoalDifference,
      opponentGoalsFor,
      form: entry.form.slice(-5),
      separatedBy: null,
    };
  });

  rows.sort((a, b) => compareStandingRows(a, b, profile));

  const positioned = rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));

  const separated = positioned.map((row, index) => {
    const above = index > 0 ? positioned[index - 1] : undefined;

    return {
      ...row,
      separatedBy: above ? separatedByAbove(above, row, profile) : null,
    };
  });

  return assignBands(separated);
}
