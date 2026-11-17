import { describe, expect, it } from "vitest";

import { applyElo, computePlayerStats, expectedScore, replayTournament } from "@/lib/stats";
import type { StatsMatch } from "@/lib/stats/types";

function match(overrides: Partial<StatsMatch> = {}): StatsMatch {
  return {
    id: "match-1",
    tournamentId: "cup",
    gameId: "efootball",
    stage: "league",
    matchday: 1,
    homeUid: "alice",
    awayUid: "bob",
    homeGoals: 2,
    awayGoals: 1,
    ...overrides,
  };
}

describe("applyElo", () => {
  it("moves an equal-rating winner to 1016 and the loser to 984", () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(applyElo({ rating: 1000, opponentRating: 1000, goalsFor: 3, goalsAgainst: 0 })).toEqual({
      rating: 1016,
      delta: 16,
      score: 1,
    });
    expect(applyElo({ rating: 1000, opponentRating: 1000, goalsFor: 0, goalsAgainst: 3 })).toEqual({
      rating: 984,
      delta: -16,
      score: 0,
    });
  });

  it("splits the points on a draw", () => {
    expect(applyElo({ rating: 1000, opponentRating: 1000, goalsFor: 1, goalsAgainst: 1 })).toEqual({
      rating: 1000,
      delta: 0,
      score: 0.5,
    });
    expect(applyElo({ rating: 1200, opponentRating: 1000, goalsFor: 2, goalsAgainst: 2 })).toEqual({
      rating: 1192,
      delta: -8,
      score: 0.5,
    });
  });

  it("rewards an upset more than a favourite's win", () => {
    const upset = applyElo({
      rating: 1000,
      opponentRating: 1200,
      goalsFor: 1,
      goalsAgainst: 0,
    });
    const expectedWin = applyElo({
      rating: 1200,
      opponentRating: 1000,
      goalsFor: 1,
      goalsAgainst: 0,
    });

    expect(upset.delta).toBe(24);
    expect(expectedWin.delta).toBe(8);
    expect(upset.rating).toBe(1024);
    expect(expectedWin.rating).toBe(1208);
  });

  it("ignores the goal margin", () => {
    expect(applyElo({ rating: 1000, opponentRating: 1000, goalsFor: 1, goalsAgainst: 0 })).toEqual(
      applyElo({ rating: 1000, opponentRating: 1000, goalsFor: 9, goalsAgainst: 0 }),
    );
  });
});

describe("computePlayerStats", () => {
  const matches: StatsMatch[] = [
    match({ id: "a", homeGoals: 3, awayGoals: 0 }),
    match({ id: "b", homeUid: "carol", awayUid: "alice", homeGoals: 1, awayGoals: 1 }),
    match({ id: "c", homeUid: "alice", awayUid: "carol", homeGoals: 0, awayGoals: 2 }),
    match({
      id: "d",
      tournamentId: "other-cup",
      gameId: "ea-sports-fc",
      stage: "final",
      matchday: 0,
      homeUid: "alice",
      awayUid: "bob",
      homeGoals: 2,
      awayGoals: 2,
    }),
    match({
      id: "e",
      tournamentId: "other-cup",
      gameId: "ea-sports-fc",
      stage: "final",
      matchday: 0,
      homeUid: "bob",
      awayUid: "carol",
      homeGoals: 1,
      awayGoals: 0,
    }),
  ];

  it("computes overall, per-game and per-tournament totals exactly", () => {
    const stats = computePlayerStats(matches, "alice", { titleTournamentIds: ["other-cup"] });

    expect(stats.overall).toEqual({
      tournaments: 2,
      played: 4,
      wins: 1,
      draws: 2,
      losses: 1,
      goalsFor: 6,
      goalsAgainst: 5,
      titles: 1,
      winRate: 0.25,
    });
    expect(stats.byGame.efootball).toEqual({
      tournaments: 1,
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 4,
      goalsAgainst: 3,
      titles: 0,
      winRate: 1 / 3,
    });
    expect(stats.byGame["ea-sports-fc"]).toEqual({
      tournaments: 1,
      played: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      goalsFor: 2,
      goalsAgainst: 2,
      titles: 1,
      winRate: 0,
    });
    expect(stats.byTournament.cup).toEqual({
      tournaments: 1,
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 4,
      goalsAgainst: 3,
      titles: 0,
      winRate: 1 / 3,
    });
  });

  it("returns real zeros for a player with no matches", () => {
    expect(computePlayerStats(matches, "nobody").overall).toEqual({
      tournaments: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      titles: 0,
      winRate: 0,
    });
  });

  it("ignores matches that do not include the player", () => {
    const stats = computePlayerStats(matches, "bob");
    expect(stats.overall.played).toBe(3);
    expect(stats.overall.goalsFor).toBe(3);
  });
});

describe("replayTournament", () => {
  const matches: StatsMatch[] = [
    match({
      id: "md2-b",
      matchday: 2,
      homeUid: "alice",
      awayUid: "carol",
      homeGoals: 1,
      awayGoals: 0,
    }),
    match({
      id: "md1-b",
      matchday: 1,
      homeUid: "bob",
      awayUid: "alice",
      homeGoals: 0,
      awayGoals: 2,
    }),
    match({
      id: "sf-1-leg-2",
      stage: "sf",
      matchday: 0,
      leg: 2,
      homeUid: "alice",
      awayUid: "bob",
      homeGoals: 1,
      awayGoals: 1,
    }),
    match({
      id: "sf-1-leg-1",
      stage: "sf",
      matchday: 0,
      leg: 1,
      homeUid: "bob",
      awayUid: "alice",
      homeGoals: 0,
      awayGoals: 1,
    }),
    match({
      id: "md1-a",
      matchday: 1,
      homeUid: "alice",
      awayUid: "bob",
      homeGoals: 3,
      awayGoals: 0,
    }),
  ];

  it("produces the same ladder regardless of input order", () => {
    const forward = replayTournament({ matches, initialRatings: {} });
    const reversed = replayTournament({
      matches: [...matches].reverse(),
      initialRatings: {},
    });

    expect(reversed.ratings).toEqual(forward.ratings);
    expect(reversed.deltas).toEqual(forward.deltas);
    expect(reversed.records).toEqual(forward.records);
    expect(forward.appliedMatches).toBe(5);
    expect(forward.records.alice).toEqual({ played: 5, wins: 4, draws: 1, losses: 0 });
    expect(forward.records.bob).toEqual({ played: 4, wins: 0, draws: 1, losses: 3 });
  });

  it("starts from the supplied pre-tournament ratings", () => {
    const replay = replayTournament({
      matches: [match({ homeGoals: 1, awayGoals: 0 })],
      initialRatings: { alice: 1200, bob: 1000 },
    });

    expect(replay.ratings).toEqual({ alice: 1208, bob: 992 });
    expect(replay.deltas).toEqual({ alice: 8, bob: -8 });
  });

  it("treats a walkover 3-0 as an ordinary win", () => {
    const walkover = replayTournament({
      matches: [match({ homeGoals: 3, awayGoals: 0 })],
      initialRatings: {},
    });
    const narrow = replayTournament({
      matches: [match({ homeGoals: 1, awayGoals: 0 })],
      initialRatings: {},
    });

    expect(walkover.ratings).toEqual(narrow.ratings);
  });
});
