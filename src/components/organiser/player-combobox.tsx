"use client";

// GCC - tournament-scoped player combobox.
//
// The organiser results page loads the 36 registrations once and filters them
// locally by gamer-tag prefix. No request is made while typing, so there is no
// unbounded public player search and no way to pick someone outside this
// competition.
import { Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export interface ComboboxPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

export interface PlayerComboboxProps {
  readonly players: readonly ComboboxPlayer[];
  readonly selectedUid: string | null;
  readonly onSelect: (uid: string) => void;
  readonly label?: string;
}

export function PlayerCombobox({
  players,
  selectedUid,
  onSelect,
  label = "Find player",
}: PlayerComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = players.find((player) => player.uid === selectedUid) ?? null;
  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      players
        .filter((player) => player.gamerTag.toLowerCase().startsWith(term))
        .sort((a, b) => a.gamerTag.localeCompare(b.gamerTag))
        .slice(0, 12),
    [players, term],
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor="result-player-search"
        className="block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
      >
        {label}
      </label>

      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-electric-400/40 bg-electric-500/[0.06] p-3">
          <Avatar name={selected.gamerTag} src={selected.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{selected.gamerTag}</p>
            <p className="text-xs text-grey-500">Registered in this tournament</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(true);
              onSelect("");
            }}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-grey-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Change
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500"
        />
        <Input
          id="result-player-search"
          type="search"
          value={query}
          placeholder="Type a gamer tag"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="result-player-options"
          aria-autocomplete="list"
          className="pl-9"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>

      {open ? (
        <ul
          id="result-player-options"
          role="listbox"
          aria-label="Registered players"
          className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-navy-900/95 p-1.5"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-grey-400">
              No registered player starts with that tag.
            </li>
          ) : (
            matches.map((player) => (
              <li key={player.uid} role="option" aria-selected={player.uid === selectedUid}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(player.uid);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                    "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                    player.uid === selectedUid ? "bg-electric-500/10" : "",
                  )}
                >
                  <Avatar name={player.gamerTag} src={player.avatarUrl} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-grey-100">
                    {player.gamerTag}
                  </span>
                  <UserRound aria-hidden="true" className="h-3.5 w-3.5 text-grey-500" />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
