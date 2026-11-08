"use client";

// GCC - public player search by gamer-tag prefix.
import { Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { Spinner } from "@/components/ui/feedback";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getGame, type GameId } from "@/lib/config/games";

interface PlayerResult {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly avatarUrl: string | null;
}

type SearchState = "idle" | "loading" | "done" | "error" | "rate-limited";

interface SearchResult {
  readonly term: string;
  readonly players: readonly PlayerResult[];
  readonly state: SearchState;
  readonly message: string | null;
}

export function PlayerSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          players?: PlayerResult[];
          error?: string;
        };

        if (response.status === 429) {
          setResult({
            term,
            players: [],
            state: "rate-limited",
            message: body.error ?? "Too many searches. Wait a moment and try again.",
          });
          return;
        }

        if (!response.ok) {
          setResult({
            term,
            players: [],
            state: "error",
            message: body.error ?? "Player search is unavailable right now.",
          });
          return;
        }

        setResult({
          term,
          players: body.players ?? [],
          state: "done",
          message: null,
        });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResult({
            term,
            players: [],
            state: "error",
            message: "The connection failed. Check your network and try again.",
          });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const showHint = term.length < 2;
  const active = !showHint && result && result.term === term ? result : null;
  const players = active?.players ?? [];
  const state: SearchState = showHint ? "idle" : active ? active.state : "loading";
  const message = active?.message ?? null;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="player-search" className="mb-1.5 block text-sm font-medium text-grey-100">
          Search by gamer tag
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500"
          />
          <input
            id="player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type at least 2 characters"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="block w-full rounded-md border border-white/15 bg-navy-900/70 py-2.5 pl-10 pr-3 text-sm text-white shadow-sm placeholder:text-grey-500 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-400/30"
          />
        </div>
        <p className="mt-1.5 text-xs leading-5 text-grey-500">
          Prefix search across real public profiles. At most 20 results are returned.
        </p>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm text-grey-400">
        {state === "loading" ? (
          <Spinner size="sm" label="Searching players" />
        ) : state === "done" ? (
          `${players.length} ${players.length === 1 ? "player" : "players"} found.`
        ) : showHint ? (
          "Enter at least 2 characters to search."
        ) : null}
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger-soft"
        >
          {message}
        </p>
      ) : null}

      {state === "done" && players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-navy-900/30 px-6 py-10 text-center">
          <UserRound aria-hidden="true" className="mx-auto h-6 w-6 text-electric-300" />
          <p className="mt-3 font-display text-xl font-semibold uppercase tracking-display text-white">
            No players match that prefix
          </p>
          <p className="mt-2 text-sm leading-6 text-grey-400">
            Try fewer characters or a different spelling. Only real, registered gamer tags appear
            here.
          </p>
        </div>
      ) : null}

      {players.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {players.map((player) => (
            <li key={player.uid}>
              <Link
                href={`/players/${encodeURIComponent(player.gamerTag)}`}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-navy-900/60 p-3 transition-colors hover:border-electric-400/40 hover:bg-navy-900"
              >
                <Avatar
                  name={player.gamerTag}
                  src={player.avatarUrl}
                  size="lg"
                  crossOrigin="anonymous"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-semibold uppercase tracking-display text-white">
                    @{player.gamerTag}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-grey-400">
                    <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
                    {countryName(player.country)} · {getGame(player.preferredGame).name}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
