// GCC - pure graphic payload mappers.
import { describe, expect, it } from "vitest";

import {
  avatarLookup,
  championGraphicData,
  championGraphicDataFromRecord,
  fixturesGraphicData,
  formatGoalDifference,
  leagueTableGraphicData,
  playerCardGraphicData,
  potsGraphicData,
  truncateGamerTag,
} from "@/lib/graphics/data";
import type { FixtureRowLike, KnockoutDataLike, LeagueTableRowLike } from "@/lib/graphics/data";
import type { GraphicPlayer, KnockoutGraphicSlot } from "@/lib/graphics/types";

const bandCycle = ["direct", "playoff_seeded", "playoff_unseeded", "eliminated"] as const;

function row(index: number): LeagueTableRowLike {
  return {
    uid: `u${index}`,
    gamerTag: `Player ${index}`,
    avatarUrl: index % 3 === 0 ? null : `https://res.cloudinary.com/demo/avatar-${index}.png`,
    position: index,
    played: 8,
    won: 5,
    drawn: 1,
    lost: 2,
    goalsFor: 18,
    goalsAgainst: 9,
    goalDifference: 9,
    points: 16,
    band: bandCycle[index % bandCycle.length] ?? "eliminated",
  };
}

const fixture = (overrides: Partial<FixtureRowLike>): FixtureRowLike => ({
  id: "m1",
  matchday: 1,
  homeUid: "u1",
  awayUid: "u2",
  homeTag: "Home Player",
  awayTag: "Away Player",
  scheduledAt: "2026-11-20T18:00:00.000Z",
  status: "scheduled",
  homeGoals: null,
  awayGoals: null,
  ...overrides,
});

const slot = (overrides: Partial<KnockoutGraphicSlot>): KnockoutGraphicSlot => ({
  uid: null,
  gamerTag: null,
  avatarUrl: null,
  position: null,
  source: "To be decided",
  ...overrides,
});

function finalTie(overrides: Partial<KnockoutDataLike["ties"][number]>) {
  return {
    tieId: "final-1",
    round: "final" as const,
    bracketSlot: 1,
    higher: slot({ uid: "u1", gamerTag: "Winner Higher", position: 1 }),
    lower: slot({ uid: "u2", gamerTag: "Winner Lower", position: 2 }),
    aggregate: { higherGoals: 2, lowerGoals: 1 },
    legsPlayed: 1,
    winnerUid: "u1",
    decidedBy: "aggregate" as const,
    penalties: null,
    complete: true,
    ...overrides,
  };
}

const champion: GraphicPlayer = {
  uid: "u1",
  gamerTag: "Champion",
  avatarUrl: null,
};

function knockout(overrides: Partial<KnockoutDataLike>): KnockoutDataLike {
  const ties = [finalTie({})];

  return {
    rounds: [{ round: "final", label: "Final", ties }],
    champion,
    runnerUp: { uid: "u2", gamerTag: "Runner", avatarUrl: null },
    legs: 1,
    ties,
    ...overrides,
  };
}

describe("truncateGamerTag", () => {
  it("keeps a tag inside the 3-16 character product range unchanged", () => {
    expect(truncateGamerTag("Nairobi Storm")).toBe("Nairobi Storm");
    expect(truncateGamerTag("SixteenCharsHere")).toBe("SixteenCharsHere");
  });

  it("trims surrounding whitespace", () => {
    expect(truncateGamerTag("  Storm  ")).toBe("Storm");
  });

  it("adds an ellipsis instead of cutting mid-character", () => {
    const result = truncateGamerTag("SeventeenCharsTag");

    expect(result).toBe("SeventeenCharsT…");
    expect(result).toHaveLength(16);
  });
});

describe("formatGoalDifference", () => {
  it("prefixes a positive difference", () => {
    expect(formatGoalDifference(12)).toBe("+12");
  });

  it("keeps zero and negatives plain", () => {
    expect(formatGoalDifference(0)).toBe("0");
    expect(formatGoalDifference(-4)).toBe("-4");
  });
});

describe("leagueTableGraphicData", () => {
  it("maps all 36 rows without dropping or duplicating a player", () => {
    const data = leagueTableGraphicData(
      Array.from({ length: 36 }, (_, index) => row(index + 1)),
      { provisional: false, title: "Final table" },
    );

    expect(data.rows).toHaveLength(36);
    expect(new Set(data.rows.map((entry) => entry.uid)).size).toBe(36);
    expect(data.subtitle).toBeNull();
  });

  it("preserves a provisional marker and subtitle", () => {
    const data = leagueTableGraphicData([row(1)], {
      provisional: true,
      title: "Matchday 3",
      subtitle: "Provisional positions",
    });

    expect(data.provisional).toBe(true);
    expect(data.subtitle).toBe("Provisional positions");
  });
});

describe("fixturesGraphicData", () => {
  const avatars = avatarLookup([
    { uid: "u1", avatarUrl: "https://res.cloudinary.com/demo/u1.png" },
    { uid: "u2", avatarUrl: null },
  ]);

  it("keeps only the requested matchday", () => {
    const data = fixturesGraphicData(
      [fixture({ id: "m1" }), fixture({ id: "m2", matchday: 2 })],
      1,
      avatars,
      { showScores: false },
    );

    expect(data.matchday).toBe(1);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0]?.id).toBe("m1");
  });

  it("joins avatars by uid and leaves a missing avatar null", () => {
    const data = fixturesGraphicData([fixture({})], 1, avatars, { showScores: false });

    expect(data.matches[0]?.home.avatarUrl).toBe("https://res.cloudinary.com/demo/u1.png");
    expect(data.matches[0]?.away.avatarUrl).toBeNull();
  });

  it("marks a fixture completed only when both goals are recorded", () => {
    const completed = fixturesGraphicData(
      [fixture({ status: "completed", homeGoals: 3, awayGoals: 0 })],
      1,
      avatars,
      { showScores: true },
    );
    const partial = fixturesGraphicData(
      [fixture({ status: "completed", homeGoals: 3, awayGoals: null })],
      1,
      avatars,
      { showScores: true },
    );

    expect(completed.matches[0]?.completed).toBe(true);
    expect(partial.matches[0]?.completed).toBe(false);
  });

  it("keeps zero-zero as a completed score rather than an empty result", () => {
    const data = fixturesGraphicData(
      [fixture({ status: "completed", homeGoals: 0, awayGoals: 0 })],
      1,
      avatars,
      { showScores: true },
    );

    expect(data.matches[0]?.completed).toBe(true);
    expect(data.matches[0]?.homeGoals).toBe(0);
    expect(data.matches[0]?.awayGoals).toBe(0);
  });

  it("falls back to a neutral label for a blank tag", () => {
    const data = fixturesGraphicData([fixture({ homeTag: "   " })], 1, avatars, {
      showScores: false,
    });

    expect(data.matches[0]?.home.gamerTag).toBe("Player");
  });
});

describe("potsGraphicData", () => {
  it("keeps four pots and every player exactly once", () => {
    const draw = {
      pots: (["1", "2", "3", "4"] as const).map((pot) => ({
        pot,
        players: Array.from({ length: 9 }, (_, index) => ({
          uid: `${pot}-${index}`,
          gamerTag: `Pot ${pot} ${index}`,
          avatarUrl: null,
        })),
      })),
    };

    const data = potsGraphicData(draw);

    expect(data.pots).toHaveLength(4);
    expect(data.pots.flatMap((pot) => pot.players)).toHaveLength(36);
  });
});

describe("championGraphicData", () => {
  it("returns null when no champion is stored", () => {
    expect(championGraphicData(knockout({ champion: null }))).toBeNull();
  });

  it("reads the final score with the champion's goals first", () => {
    const data = championGraphicData(knockout({}));

    expect(data?.finalScore).toBe("2–1");
    expect(data?.runnerUp?.gamerTag).toBe("Runner");
  });

  it("reverses the score when the champion was the lower seed", () => {
    const tie = finalTie({ winnerUid: "u2", aggregate: { higherGoals: 1, lowerGoals: 3 } });
    const data = championGraphicData(
      knockout({
        champion: { uid: "u2", gamerTag: "Champion", avatarUrl: null },
        ties: [tie],
        rounds: [{ round: "final", label: "Final", ties: [tie] }],
      }),
    );

    expect(data?.finalScore).toBe("3–1");
  });

  it("labels a penalty decider without inflating the aggregate", () => {
    const tie = finalTie({
      decidedBy: "penalties",
      penalties: { higher: 4, lower: 3 },
      aggregate: { higherGoals: 1, lowerGoals: 1 },
    });
    const data = championGraphicData(
      knockout({ ties: [tie], rounds: [{ round: "final", label: "Final", ties: [tie] }] }),
    );

    expect(data?.finalScore).toBe("1–1");
    expect(data?.scoreNote).toBe("Penalties 4–3");
  });

  it("does not invent a score before the final has been played", () => {
    const tie = finalTie({ legsPlayed: 0, aggregate: { higherGoals: 0, lowerGoals: 0 } });
    const data = championGraphicData(
      knockout({ ties: [tie], rounds: [{ round: "final", label: "Final", ties: [tie] }] }),
    );

    expect(data?.finalScore).toBeNull();
  });
});

describe("championGraphicDataFromRecord", () => {
  it("uses the Hall of Fame record when the bracket is unavailable", () => {
    const data = championGraphicDataFromRecord(
      {
        tournamentName: "GCC Invitational",
        season: "2026",
        championUid: "u1",
        championTag: "Champion",
        championAvatarUrl: null,
        finalistUid: "u2",
        finalistTag: "Runner",
        finalistAvatarUrl: null,
        stats: { played: 8, wins: 6, draws: 1, losses: 1, goalsFor: 20, goalsAgainst: 7 },
      },
      null,
    );

    expect(data.champion.uid).toBe("u1");
    expect(data.runnerUp?.uid).toBe("u2");
    expect(data.finalScore).toBeNull();
    expect(data.championRecord).toEqual({
      played: 8,
      wins: 6,
      draws: 1,
      losses: 1,
      goalsFor: 20,
      goalsAgainst: 7,
    });
  });
});

describe("playerCardGraphicData", () => {
  it("trims blank optional fields to null", () => {
    const data = playerCardGraphicData({
      player: { uid: "u1", gamerTag: "Player One", avatarUrl: null },
      country: "KE",
      community: "   ",
      favouriteClub: "",
      platform: "  ",
      game: "eFootball",
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      tournaments: 0,
      titles: 0,
      winRate: 0,
      rating: null,
      rank: null,
      eligible: false,
      ratedMatches: 0,
      profileUrl: "https://gcc.example/players/Player%20One",
      qrSvg: "",
    });

    expect(data.community).toBeNull();
    expect(data.favouriteClub).toBeNull();
    expect(data.platform).toBeNull();
    expect(data.rating).toBeNull();
  });
});
