"use client";

// GCC - type-to-filter player picker for head-to-head.
//
// It reuses the public player search endpoint. The form still works if
// JavaScript is unavailable because the typed tag is submitted directly; the
// suggestion list only helps the user pick a real public profile.
import { Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getGame, type GameId } from "@/lib/config/games";
import { cn } from "@/lib/utils/cn";

interface PickerPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly avatarUrl: string | null;
  readonly titles: number;
}

export interface PlayerPickerProps {
  readonly name: string;
  readonly label: string;
  readonly initialTag?: string | null;
  readonly placeholder?: string;
}

export function PlayerPicker({ name, label, initialTag, placeholder }: PlayerPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState(initialTag ?? "");
  const [selected, setSelected] = useState<string | null>(initialTag ?? null);
  const [players, setPlayers] = useState<PickerPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const term = query.trim();
  const submitted = selected ?? term;

  useEffect(() => {
    if (term.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          players?: PickerPlayer[];
        };

        setPlayers(response.ok && Array.isArray(body.players) ? body.players : []);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setPlayers([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const visible = useMemo(
    () =>
      term.length < 2
        ? []
        : players
            .filter((player) => player.gamerTag.toLowerCase().startsWith(term.toLowerCase()))
            .slice(0, 8),
    [players, term],
  );

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`${listId}-input`}
        className="block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
      >
        {label}
      </label>
      <input type="hidden" name={name} value={submitted} />

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500"
        />
        <Input
          id={`${listId}-input`}
          type="search"
          value={query}
          placeholder={placeholder ?? "Type a gamer tag"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="pl-9 pr-9"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelected(null);
              setPlayers([]);
            }}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-grey-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {selected ? (
        <p className="text-xs text-grey-500">
          Selected <span className="font-semibold text-grey-300">@{selected}</span>
        </p>
      ) : null}

      {open && term.length >= 2 ? (
        <div
          className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-navy-950/95 p-1.5"
          aria-live="polite"
        >
          {loading ? (
            <div className="px-3 py-2">
              <Spinner size="sm" label="Searching players" />
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-grey-400">
              No public profile starts with that tag. You can still submit the exact tag.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label={label}>
              {visible.map((player) => (
                <li key={player.uid} role="option" aria-selected={player.gamerTag === selected}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(player.gamerTag);
                      setQuery(player.gamerTag);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                    )}
                  >
                    <Avatar name={player.gamerTag} src={player.avatarUrl} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-grey-100">
                        {player.gamerTag}
                      </span>
                      <span className="block truncate text-xs text-grey-500">
                        <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
                        {countryName(player.country)} · {getGame(player.preferredGame).name}
                      </span>
                    </span>
                    <UserRound aria-hidden="true" className="h-3.5 w-3.5 text-grey-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
