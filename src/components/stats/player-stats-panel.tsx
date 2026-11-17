"use client";

// GCC - player statistics explorer.
//
// Totals are computed on the server from completed matches. This component only
// switches between scopes: every competition, one game, or one completed
// tournament. It never derives a number of its own, and it never shows a rating
// as ranked until the ladder threshold is met.
import { BarChart3, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { getGame, type GameId } from "@/lib/config/games";
import { RATED_MATCH_THRESHOLD } from "@/lib/stats/constants";
import {
  PLAYER_FINAL_STAGE_LABELS,
  type PlayerFinalStage,
  type ProfileStatTotals,
} from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export type StatsTotalsView = ProfileStatTotals;

export interface GameStatsView extends StatsTotalsView {
  readonly gameId: GameId;
  readonly rating: number | null;
  readonly ratedMatches: number;
  readonly rank: number | null;
  readonly eligible: boolean;
}

export interface TournamentStatsView extends StatsTotalsView {
  readonly tournamentId: string;
  readonly name: string;
  readonly season: string;
  readonly gameId: GameId;
  readonly finalStage: PlayerFinalStage;
  readonly finalPosition: number;
  readonly wonTitle: boolean;
}

export interface PlayerStatsPanelProps {
  readonly overall: StatsTotalsView;
  readonly games: readonly GameStatsView[];
  readonly tournaments: readonly TournamentStatsView[];
}

const rate = (totals: StatsTotalsView): string =>
  totals.played > 0 ? `${Math.round(totals.winRate * 100)}%` : "—";

function StatTiles({ totals }: { readonly totals: StatsTotalsView }) {
  const tiles = [
    { label: "Tournaments", value: totals.tournaments },
    { label: "Played", value: totals.played },
    { label: "Wins", value: totals.wins },
    { label: "Draws", value: totals.draws },
    { label: "Losses", value: totals.losses },
    { label: "Goals for", value: totals.goalsFor },
    { label: "Goals against", value: totals.goalsAgainst },
    { label: "Win rate", value: rate(totals) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-white/10 bg-navy-950/50 px-3 py-3 text-center"
        >
          <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
            {tile.label}
          </dt>
          <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RatingCard({ games }: { readonly games: readonly GameStatsView[] }) {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(
    games.find((game) => game.rating !== null)?.gameId ?? games[0]?.gameId ?? null,
  );
  const active = useMemo(
    () => games.find((game) => game.gameId === selectedGame) ?? games[0] ?? null,
    [games, selectedGame],
  );

  if (!active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-grey-400">
            No rated matches yet. A rating appears after your first completed tournament on a game.
          </p>
        </CardContent>
      </Card>
    );
  }

  const remaining = Math.max(0, RATED_MATCH_THRESHOLD - active.ratedMatches);
  const hasRating = active.rating !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Rating</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-grey-400">
            <BarChart3 aria-hidden="true" className="h-3.5 w-3.5" />
            Elo per game
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {games.length > 1 ? (
          <div
            role="group"
            aria-label="Choose a game rating"
            className="flex snap-x gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-navy-950/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {games.map((game) => (
              <button
                key={game.gameId}
                type="button"
                aria-pressed={game.gameId === active.gameId}
                onClick={() => setSelectedGame(game.gameId)}
                className={cn(
                  "inline-flex min-h-10 snap-start items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                  game.gameId === active.gameId
                    ? "bg-electric-500/20 text-white"
                    : "text-grey-400 hover:text-white",
                )}
              >
                {getGame(game.gameId).name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              {getGame(active.gameId).name}
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-white">
              {hasRating ? Math.round(active.rating ?? 0) : "Unranked"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              Ladder position
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
              {active.eligible && active.rank !== null ? `#${active.rank}` : "—"}
            </p>
          </div>
        </div>

        <p className="text-xs leading-5 text-grey-400">
          {active.eligible
            ? `${active.ratedMatches} rated ${active.ratedMatches === 1 ? "match" : "matches"} on this game. Rank is calculated from the public ladder.`
            : hasRating
              ? `Unranked. ${remaining} more rated ${remaining === 1 ? "match" : "matches"} needed to enter the ladder; ${active.ratedMatches} recorded so far.`
              : "Your first completed tournament sets a starting rating. Only completed tournaments move a rating."}
        </p>
      </CardContent>
    </Card>
  );
}

export function PlayerStatsPanel({ overall, games, tournaments }: PlayerStatsPanelProps) {
  const [scope, setScope] = useState("all");
  const tournament = tournaments.find((entry) => `tournament:${entry.tournamentId}` === scope);
  const game = games.find((entry) => `game:${entry.gameId}` === scope);
  const totals = tournament ?? game ?? overall;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">Record</CardTitle>
              <label className="w-full sm:w-auto">
                <span className="sr-only">Statistics scope</span>
                <Select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  aria-label="Statistics scope"
                  className="py-2 text-xs"
                >
                  <option value="all">All competitions</option>
                  {games.length > 0 ? (
                    <optgroup label="By game">
                      {games.map((entry) => (
                        <option key={entry.gameId} value={`game:${entry.gameId}`}>
                          {getGame(entry.gameId).name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {tournaments.length > 0 ? (
                    <optgroup label="By tournament">
                      {tournaments.map((entry) => (
                        <option key={entry.tournamentId} value={`tournament:${entry.tournamentId}`}>
                          {entry.name}
                          {entry.season ? ` (${entry.season})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tournament ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tournament.wonTitle ? "gold" : "neutral"}>
                  {tournament.wonTitle ? (
                    <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : null}
                  {tournament.wonTitle
                    ? "Champion"
                    : `${PLAYER_FINAL_STAGE_LABELS[tournament.finalStage]} · ${tournament.finalPosition}`}
                </Badge>
                <span className="text-xs text-grey-500">
                  {getGame(tournament.gameId).name}
                  {tournament.season ? ` · ${tournament.season}` : ""}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={totals.titles > 0 ? "gold" : "neutral"}>
                  <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                  {totals.titles} {totals.titles === 1 ? "title" : "titles"}
                </Badge>
                {game ? (
                  <span className="text-xs text-grey-500">{getGame(game.gameId).name}</span>
                ) : null}
              </div>
            )}

            <StatTiles totals={totals} />

            <p className="text-xs leading-5 text-grey-400">
              {totals.played > 0
                ? "Recorded from completed matches only. Win rate is wins divided by matches played."
                : "No completed matches in this scope, so every total is a real zero."}
            </p>
          </CardContent>
        </Card>

        <RatingCard games={games} />
      </div>
    </div>
  );
}
