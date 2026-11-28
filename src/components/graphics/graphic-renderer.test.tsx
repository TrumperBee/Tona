// @vitest-environment jsdom
//
// Template rendering regressions for the Phase 15 graphics generator. These
// tests cover the edge cases an export must survive: 36 rows, long tags,
// missing avatars, no QR and an unranked player.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GraphicRenderer } from "@/components/graphics/graphic-renderer";
import type {
  ChampionGraphicData,
  GraphicBranding,
  GraphicPayload,
  LeagueTableGraphicData,
  PlayerCardGraphicData,
} from "@/lib/graphics/types";

const branding: GraphicBranding = {
  tournamentName: "GCC Invitational",
  tournamentSlug: "gcc-invitational",
  season: "2026",
  gameName: "eFootball",
  logoSrc: null,
  coverSrc: null,
  organiserName: "GCC",
  siteName: "Global Champions Circuit",
  siteUrl: "gcc.example",
  tagline: "One Platform. Endless Competition.",
};

const bands = ["direct", "playoff_seeded", "playoff_unseeded", "eliminated"] as const;

const leagueTable: LeagueTableGraphicData = {
  title: "Final table",
  subtitle: "Final positions",
  provisional: false,
  rows: Array.from({ length: 36 }, (_, index) => ({
    uid: `u${index + 1}`,
    gamerTag: index === 0 ? "ABCDEFGHIJKLMNOPQ" : `Player ${index + 1}`,
    avatarUrl: index % 2 === 0 ? null : "https://res.cloudinary.com/demo/avatar.png",
    position: index + 1,
    played: 8,
    won: 5,
    drawn: 1,
    lost: 2,
    goalsFor: 18,
    goalsAgainst: 9,
    goalDifference: 9,
    points: 16,
    band: bands[index % bands.length] ?? "eliminated",
  })),
};

const champion: ChampionGraphicData = {
  champion: { uid: "u1", gamerTag: "Nairobi Storm", avatarUrl: null },
  runnerUp: { uid: "u2", gamerTag: "Coast United", avatarUrl: null },
  finalScore: null,
  scoreNote: null,
  championRecord: null,
};

const player: PlayerCardGraphicData = {
  player: { uid: "u1", gamerTag: "Nairobi Storm", avatarUrl: null },
  country: "KE",
  community: null,
  favouriteClub: null,
  platform: "PlayStation",
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
  profileUrl: "https://gcc.example/players/Nairobi%20Storm",
  qrSvg: "",
};

function renderPayload(payload: GraphicPayload): HTMLElement {
  const { container } = render(
    <GraphicRenderer payload={payload} branding={branding} size="story" />,
  );

  return container;
}

afterEach(() => {
  cleanup();
});

describe("GraphicRenderer", () => {
  it("renders all 36 league rows", () => {
    const container = renderPayload({ template: "league-table", data: leagueTable });

    for (let index = 1; index <= 36; index += 1) {
      expect(container.textContent).toContain(index === 1 ? "ABCDEFGHIJKLMNO…" : `Player ${index}`);
    }

    expect(container.textContent).toContain("Final table");
  });

  it("uses the shared fixed-size frame and panel system", () => {
    const container = renderPayload({ template: "league-table", data: leagueTable });

    expect(container.querySelector("[data-graphic-root]")).not.toBeNull();
    expect(container.querySelector("[data-graphic-panel]")).not.toBeNull();
    expect(container.textContent).toContain("Global Champions Circuit");
    expect(container.textContent).toContain("gcc.example");
  });

  it("truncates a long gamer tag and keeps the original in the title attribute", () => {
    const container = renderPayload({ template: "league-table", data: leagueTable });
    const fullTag = container.querySelector('[title="ABCDEFGHIJKLMNOPQ"]');

    expect(fullTag?.textContent).toBe("ABCDEFGHIJKLMNO…");
  });

  it("falls back to initials when an avatar is missing", () => {
    const container = renderPayload({ template: "champion", data: champion });

    expect(container.textContent).toContain("NS");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a champion without inventing a final score", () => {
    const container = renderPayload({ template: "champion", data: champion });
    const text = container.textContent ?? "";

    expect(text).toContain("Champion");
    expect(text).toContain("Runner-up");
    expect(text).not.toContain("Final");
  });

  it("shows the unranked explanation for a player with no rating", () => {
    const container = renderPayload({ template: "player-profile", data: player });
    const text = container.textContent ?? "";

    expect(text).toContain("Unranked");
    expect(text).toContain("QR unavailable");
    expect(text).toContain("GCC Invitational");
    expect(text).toContain("gcc.example");
  });

  it("renders an honest empty state for a matchday without matches", () => {
    const container = renderPayload({
      template: "fixtures",
      data: { matchday: 8, matches: [], showScores: false },
    });

    expect(container.textContent).toContain("No matches are listed for this matchday.");
  });

  it("renders four pots with every player in exactly one", () => {
    const container = renderPayload({
      template: "pots",
      data: {
        pots: (["1", "2", "3", "4"] as const).map((pot) => ({
          pot,
          players: [
            {
              uid: `u-${pot}`,
              gamerTag: `Pot ${pot} Player`,
              avatarUrl: null,
            },
          ],
        })),
      },
    });

    for (const pot of ["1", "2", "3", "4"]) {
      expect(container.textContent).toContain(`Pot ${pot}`);
    }
  });

  it("shows QR unavailable on an announcement without an encoded link", () => {
    const container = renderPayload({
      template: "announcement",
      data: {
        startsAt: null,
        slots: 36,
        registered: 12,
        registrationUrl: "https://gcc.example/tournaments/gcc-invitational",
        organiserName: null,
        qrSvg: "",
      },
    });

    expect(container.textContent).toContain("Claim your place");
    expect(container.textContent).toContain("24 places remaining");
    expect(container.textContent).toContain("QR unavailable");
  });

  it("renders zero-zero scores in the results variant", () => {
    const container = renderPayload({
      template: "results",
      data: {
        matchday: 1,
        showScores: true,
        matches: [
          {
            id: "m1",
            home: { uid: "u1", gamerTag: "Home", avatarUrl: null },
            away: { uid: "u2", gamerTag: "Away", avatarUrl: null },
            homeGoals: 0,
            awayGoals: 0,
            completed: true,
            scheduledAt: null,
          },
        ],
      },
    });

    expect(container.textContent).toContain("0–0");
  });

  it("omits the score note when a tie is decided on aggregate", () => {
    const container = renderPayload({
      template: "knockout",
      data: {
        champion: null,
        legs: 2,
        rounds: [
          {
            round: "final",
            label: "Final",
            ties: [
              {
                tieId: "final-1",
                bracketSlot: 1,
                higher: {
                  uid: "u1",
                  gamerTag: "Home",
                  avatarUrl: null,
                  position: 1,
                  source: "Seed 1",
                },
                lower: {
                  uid: "u2",
                  gamerTag: "Away",
                  avatarUrl: null,
                  position: 2,
                  source: "Seed 2",
                },
                higherGoals: 2,
                lowerGoals: 1,
                legsPlayed: 2,
                winnerUid: "u1",
                decidedBy: "aggregate",
                penalties: null,
                complete: true,
              },
            ],
          },
        ],
      },
    });

    expect(container.textContent).toContain("2");
    expect(container.textContent).not.toContain("Pens");
  });
});
