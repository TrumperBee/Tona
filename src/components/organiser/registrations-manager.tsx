"use client";

// GCC - organiser registrations management actions.
//
// The page renders the real rows on the server; this file owns the three
// interactive pieces: issuing a WhatsApp contact link (the number stays on the
// server, only the wa.me link is returned), removing a player with a required
// reason, and adding a player through the public gamer-tag search.
import { MessageCircle, Search, UserPlus, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { countryFlag, countryName } from "@/lib/config/countries";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

const MIN_REASON = 5;
const MAX_REASON = 300;

interface PlayerResult {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly avatarUrl: string | null;
}

/** Contact + remove actions for one registration row. */
export function RegistrationRowActions({
  tournamentId,
  uid,
  gamerTag,
  canRemove,
}: {
  readonly tournamentId: string;
  readonly uid: string;
  readonly gamerTag: string;
  readonly canRemove: boolean;
}) {
  const refresh = useRefreshPreservingScroll();
  const { toast } = useToast();
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function contact(): Promise<void> {
    if (contacting) {
      return;
    }

    setContacting(true);
    setContactError(null);

    try {
      const response = await fetch(
        `/api/organiser/tournaments/${tournamentId}/registrations/${encodeURIComponent(uid)}/contact`,
      );
      const body = (await response.json().catch(() => ({}))) as {
        readonly link?: string;
        readonly error?: string;
      };

      if (!response.ok || !body.link) {
        setContactError(body.error ?? "The contact link could not be created. Try again.");
        return;
      }

      // The wa.me link opens with a generic pre-filled message; the player's
      // number itself never reaches the browser.
      window.open(body.link, "_blank", "noopener,noreferrer");
    } catch {
      setContactError("The connection failed. Check your network and try again.");
    } finally {
      setContacting(false);
    }
  }

  async function remove(): Promise<void> {
    const trimmed = reason.trim();

    if (trimmed.length < MIN_REASON || trimmed.length > MAX_REASON || removing) {
      return;
    }

    setRemoving(true);
    setRemoveError(null);

    try {
      const response = await fetch(
        `/api/organiser/tournaments/${tournamentId}/registrations/${encodeURIComponent(uid)}/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        readonly error?: string;
        readonly fields?: Record<string, string>;
      };

      if (!response.ok) {
        setRemoveError(
          body.fields?.reason ?? body.error ?? "The player could not be removed. Try again.",
        );
        return;
      }

      setRemoveOpen(false);
      setReason("");
      toast({ title: "Entry removed", description: `${gamerTag} was removed.`, tone: "success" });
      refresh();
    } catch {
      setRemoveError("The connection failed. Check your network and try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<MessageCircle aria-hidden="true" className="h-4 w-4" />}
        onClick={() => void contact()}
        loading={contacting}
        loadingLabel="Opening"
        disabled={contacting}
      >
        Contact
      </Button>

      {canRemove ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<UserRoundX aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setRemoveError(null);
            setRemoveOpen(true);
          }}
        >
          Remove
        </Button>
      ) : null}

      {contactError ? (
        <p role="alert" className="text-xs text-danger-soft">
          {contactError}
        </p>
      ) : null}

      <Dialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (!removing) {
            setRemoveOpen(open);
          }
        }}
        title={`Remove ${gamerTag}?`}
        description="Removed players keep their records but cannot re-enter on their own; only you can add them back while registration is still possible."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removing}
              loadingLabel="Removing"
              disabled={reason.trim().length < MIN_REASON || reason.trim().length > MAX_REASON}
              onClick={() => void remove()}
            >
              Remove player
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label
            htmlFor={`remove-reason-${uid}`}
            className="block text-sm font-medium text-grey-200"
          >
            Reason ({MIN_REASON}-{MAX_REASON} characters, shown to the player and recorded in the
            audit log)
          </label>
          <Textarea
            id={`remove-reason-${uid}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={MAX_REASON + 1}
            placeholder="For example: no-show for two scheduled matches."
          />
          {removeError ? (
            <p role="alert" className="text-sm font-medium text-danger-soft">
              {removeError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

/** Search-and-add panel for entering a player directly. */
export function AddPlayerPanel({
  tournamentId,
  disabled,
  disabledReason,
}: {
  readonly tournamentId: string;
  readonly disabled: boolean;
  readonly disabledReason: string | null;
}) {
  const refresh = useRefreshPreservingScroll();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly PlayerResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const term = query.trim();
  const visibleResults = !disabled && term.length >= 2 ? results : null;
  const visibleSearching = !disabled && term.length >= 2 && searching;

  useEffect(() => {
    if (disabled || term.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          readonly players?: PlayerResult[];
          readonly error?: string;
        };

        if (!response.ok) {
          setError(body.error ?? "The player search failed. Try again.");
          setResults([]);
          return;
        }

        setError(null);
        setResults(body.players ?? []);
      } catch (searchError) {
        if ((searchError as { name?: string }).name !== "AbortError") {
          setError("The connection failed. Check your network and try again.");
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, disabled]);

  async function add(uid: string): Promise<void> {
    if (addingUid) {
      return;
    }

    setAddingUid(uid);
    setError(null);

    try {
      const response = await fetch(`/api/organiser/tournaments/${tournamentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const body = (await response.json().catch(() => ({}))) as { readonly error?: string };

      if (!response.ok) {
        setError(body.error ?? "That player could not be added. Try again.");
        return;
      }

      setQuery("");
      setResults(null);
      toast({ title: "Player added", tone: "success" });
      refresh();
    } catch {
      setError("The connection failed. Check your network and try again.");
    } finally {
      setAddingUid(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-display text-white">
          <UserPlus aria-hidden="true" className="h-4 w-4 text-electric-300" />
          Add a player directly
        </h3>
        <p className="text-xs text-grey-500">
          The window is ignored; capacity, restrictions and the pre-pots stage still apply.
        </p>
      </div>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Unavailable" : "Search by gamer tag (at least 2 characters)"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Search players to add"
          className="block w-full rounded-md border border-white/15 bg-navy-900/70 py-2.5 pl-10 pr-3 text-sm text-white shadow-sm placeholder:text-grey-500 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-400/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {disabled && disabledReason ? (
        <p className="text-xs leading-5 text-grey-500">{disabledReason}</p>
      ) : null}

      {visibleSearching ? (
        <div aria-live="polite" className="min-h-6">
          <Spinner size="sm" label="Searching players" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-soft">
          {error}
        </p>
      ) : null}

      {visibleResults && visibleResults.length === 0 && !visibleSearching && !error ? (
        <p className="text-sm text-grey-400">
          No players match that prefix. Only real, registered gamer tags can be added.
        </p>
      ) : null}

      {visibleResults && visibleResults.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visibleResults.map((player) => (
            <li
              key={player.uid}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-navy-950/50 p-3"
            >
              <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold uppercase tracking-display text-white">
                  @{player.gamerTag}
                </span>
                <span className="block truncate text-xs text-grey-500">
                  <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
                  {countryName(player.country)}
                </span>
              </span>
              <Button
                size="sm"
                onClick={() => void add(player.uid)}
                loading={addingUid === player.uid}
                loadingLabel="Adding"
                disabled={addingUid !== null && addingUid !== player.uid}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
