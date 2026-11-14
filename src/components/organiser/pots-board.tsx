"use client";

// GCC - organiser pots board.
//
// The server renders the authoritative draw and this component only sends the
// six explicit actions. Every control is a plain button or select so the whole
// board is keyboard-accessible without drag-and-drop: each player has a
// "Move to…" select, a pin toggle, and the page refreshes from the server after
// every accepted mutation.
import {
  CheckCircle2,
  Eraser,
  Lock,
  Search,
  ShieldCheck,
  Shuffle,
  Undo2,
  Unlock,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { countryFlag, countryName } from "@/lib/config/countries";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";
import type { DrawMethod } from "@/types/domain";

const POT_KEYS = ["1", "2", "3", "4"] as const;
const POT_SIZE = 9;
type PotKey = (typeof POT_KEYS)[number];

export interface PotsBoardPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

export interface PotsBoardProps {
  readonly tournamentId: string;
  readonly status: "draft" | "confirmed";
  readonly pots: Readonly<Record<PotKey, readonly PotsBoardPlayer[]>>;
  readonly unassigned: readonly PotsBoardPlayer[];
  readonly locks: Readonly<Record<string, PotKey>>;
  readonly method: DrawMethod | null;
  readonly shuffleSeed: string | null;
  readonly confirmedAt: string | null;
  readonly registeredIds: readonly string[];
  readonly canReplace: boolean;
  readonly availabilityReason: string | null;
}

const METHOD_LABELS: Readonly<Record<DrawMethod, string>> = {
  shuffle: "Seeded shuffle",
  manual: "Manual placement",
  mixed: "Seeded shuffle with pinned players",
};

interface PlayerResult {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly avatarUrl: string | null;
}

interface ApiBody {
  readonly error?: string;
  readonly fields?: Record<string, string>;
}

async function sendAction(
  path: string,
  method: "POST" | "PUT",
  body?: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as ApiBody;

    if (!response.ok) {
      return (
        (data.fields && Object.values(data.fields)[0]) ??
        data.error ??
        "That change did not save. Try again."
      );
    }

    return null;
  } catch {
    return "The connection failed. Check your network and try again.";
  }
}

function potList(
  pots: PotsBoardProps["pots"],
  unassigned: PotsBoardProps["unassigned"],
): PotsBoardPlayer[] {
  const seen = new Set<string>();
  const rows: PotsBoardPlayer[] = [];

  for (const player of [...POT_KEYS.flatMap((key) => pots[key]), ...unassigned]) {
    if (!seen.has(player.uid)) {
      seen.add(player.uid);
      rows.push(player);
    }
  }

  return rows;
}

function PotColumn({
  title,
  count,
  invalid,
  children,
}: {
  readonly title: string;
  readonly count: string;
  readonly invalid?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-40 flex-col rounded-xl border p-3 ${
        invalid ? "border-danger/40 bg-danger/[0.04]" : "border-white/10 bg-navy-900/60"
      }`}
      aria-label={`${title}, ${count}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-display text-white">
          {title}
        </h3>
        <span
          className={`text-xs font-semibold tabular-nums ${
            invalid ? "text-danger-soft" : "text-grey-400"
          }`}
        >
          {count}
        </span>
      </header>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

/** Read-only pot list used after confirmation and in the public Pots tab. */
export function PotSummary({
  pots,
  showLinks = true,
}: {
  readonly pots: Readonly<Record<PotKey, readonly PotsBoardPlayer[]>>;
  readonly showLinks?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {POT_KEYS.map((key) => (
        <section
          key={key}
          aria-label={`Pot ${key}`}
          className="rounded-xl border border-white/10 bg-navy-900/60 p-3"
        >
          <header className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-xs font-semibold uppercase tracking-display text-white">
              Pot {key}
            </h3>
            <span className="text-xs font-semibold tabular-nums text-grey-400">
              {pots[key].length}/{POT_SIZE}
            </span>
          </header>
          <ul className="space-y-1.5">
            {pots[key].map((player) => (
              <li key={player.uid}>
                {showLinks ? (
                  <a
                    href={`/players/${encodeURIComponent(player.gamerTag)}`}
                    className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                  >
                    <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
                    <span className="min-w-0 truncate text-xs font-medium text-grey-200">
                      @{player.gamerTag}
                    </span>
                  </a>
                ) : (
                  <span className="flex items-center gap-2 p-1">
                    <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
                    <span className="min-w-0 truncate text-xs font-medium text-grey-200">
                      @{player.gamerTag}
                    </span>
                    {player.country ? (
                      <span className="ml-auto text-xs text-grey-400" aria-hidden="true">
                        {countryFlag(player.country)}
                      </span>
                    ) : null}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PotsBoard(props: PotsBoardProps) {
  const refresh = useRefreshPreservingScroll();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const confirmed = props.status === "confirmed";
  const editable = !confirmed && props.availabilityReason === null;
  const allPotsFull = POT_KEYS.every((key) => props.pots[key].length === POT_SIZE);
  const complete =
    allPotsFull && props.unassigned.length === 0 && props.registeredIds.length === 36;
  const lockedCount = Object.keys(props.locks).length;

  async function run(
    token: string,
    path: string,
    method: "POST" | "PUT",
    body?: unknown,
  ): Promise<boolean> {
    if (busy) {
      return false;
    }

    setBusy(token);
    setError(null);
    const message = await sendAction(
      `/api/organiser/tournaments/${props.tournamentId}/draw/${path}`,
      method,
      body,
    );

    if (message) {
      setError(message);
      setBusy(null);
      return false;
    }

    toast({ title: "Draw saved", description: "The pot draw was updated.", tone: "success" });
    refresh();
    setBusy(null);
    return true;
  }

  function move(uid: string, pot: PotKey | null): void {
    void run(`assign:${uid}`, "assign", "PUT", { uid, pot: pot === null ? null : Number(pot) });
  }

  function toggleLock(uid: string, locked: boolean): void {
    void run(`lock:${uid}`, "lock", "PUT", { uid, locked });
  }

  if (props.availabilityReason) {
    return (
      <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.04] p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-display text-gold-200">
          The draw is not available yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-grey-300">{props.availabilityReason}</p>
        <p className="mt-2 text-xs leading-5 text-grey-400">
          The pots stage opens when registration is closed with exactly 36 registered players. No
          draw is generated while the field is incomplete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/[0.06] p-3 text-sm text-danger-soft"
        >
          {error}
        </p>
      ) : null}

      {confirmed ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/[0.06] p-4">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-success-soft" />
          <p className="text-sm font-semibold text-success-soft">The draw is confirmed</p>
          {props.confirmedAt ? (
            <p className="text-xs text-grey-400">Confirmed {props.confirmedAt}</p>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            {props.canReplace ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<UserRoundCog aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setReplaceOpen(true)}
                disabled={Boolean(busy)}
              >
                Replace player
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Undo2 aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setUndoOpen(true)}
              disabled={Boolean(busy)}
            >
              Undo confirmation
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            leftIcon={<Shuffle aria-hidden="true" className="h-4 w-4" />}
            onClick={() =>
              void run("shuffle", "shuffle", "POST", { locked: numericLocks(props.locks) })
            }
            loading={busy === "shuffle"}
            loadingLabel="Shuffling"
            disabled={Boolean(busy)}
          >
            {lockedCount > 0 ? "Shuffle unlocked" : "Shuffle the field"}
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Eraser aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setClearOpen(true)}
            disabled={Boolean(busy)}
          >
            Clear
          </Button>
          <Button
            variant="gold"
            leftIcon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setConfirmOpen(true)}
            disabled={Boolean(busy) || !complete || !editable}
          >
            Confirm the draw
          </Button>
          <p className="ml-auto text-xs text-grey-400">
            {props.unassigned.length} unassigned · {lockedCount} pinned
          </p>
        </div>
      )}

      {confirmed ? (
        <PotSummary pots={props.pots} showLinks={false} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PotColumn
            title="Unassigned"
            count={`${props.unassigned.length} of ${props.registeredIds.length}`}
            invalid={props.unassigned.length > 0}
          >
            {props.unassigned.length === 0 ? (
              <li className="text-xs text-grey-400">Everyone is in a pot.</li>
            ) : (
              props.unassigned.map((player) => (
                <PlayerRow
                  key={player.uid}
                  player={player}
                  pot={null}
                  locked={false}
                  editable={editable}
                  busy={Boolean(busy)}
                  onMove={move}
                  onLock={toggleLock}
                />
              ))
            )}
          </PotColumn>

          {POT_KEYS.map((key) => {
            const pot = props.pots[key];
            return (
              <PotColumn
                key={key}
                title={`Pot ${key}`}
                count={`${pot.length}/${POT_SIZE}`}
                invalid={pot.length !== POT_SIZE}
              >
                {pot.length === 0 ? (
                  <li className="text-xs text-grey-400">No players yet.</li>
                ) : (
                  pot.map((player) => (
                    <PlayerRow
                      key={player.uid}
                      player={player}
                      pot={key}
                      locked={Boolean(props.locks[player.uid])}
                      editable={editable}
                      busy={Boolean(busy)}
                      onMove={move}
                      onLock={toggleLock}
                    />
                  ))
                )}
              </PotColumn>
            );
          })}
        </div>
      )}

      {!confirmed ? (
        <div className="rounded-xl border border-white/10 bg-navy-900/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
            Validation
          </p>
          <ul className="mt-2 space-y-1 text-sm text-grey-300">
            <li>
              {props.registeredIds.length === 36
                ? "Exactly 36 players are registered."
                : `${props.registeredIds.length} of 36 players registered — the draw cannot be confirmed.`}
            </li>
            <li>
              {allPotsFull
                ? "Every pot holds exactly nine players."
                : "Each pot must hold exactly nine players."}
            </li>
            <li>
              {props.unassigned.length === 0
                ? "Every player is assigned to a pot."
                : `${props.unassigned.length} player${props.unassigned.length === 1 ? " is" : "s are"} still unassigned.`}
            </li>
          </ul>
        </div>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-navy-900/40 p-4 text-xs leading-5 text-grey-400">
        <p className="font-semibold uppercase tracking-eyebrow text-grey-400">Transparency</p>
        <p className="mt-1">
          Method: {props.method ? METHOD_LABELS[props.method] : "Not recorded"}.
          {props.shuffleSeed ? (
            <>
              {" "}
              Shuffle seed: <code className="break-all text-grey-300">{props.shuffleSeed}</code>.
            </>
          ) : null}{" "}
          {props.method === "manual"
            ? "This draw was assembled by hand; every move and the confirmation are in the audit log."
            : "Every placement comes from the recorded seed, so the draw can be replayed and verified after the fact."}
        </p>
        {confirmed ? (
          <p className="mt-1">
            The draw becomes public on the tournament page only after confirmation.
          </p>
        ) : null}
      </section>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => !busy && setConfirmOpen(open)}
        title="Confirm the draw?"
        description="The four pots become public and fixtures can be generated next. The draw is locked until you undo the confirmation."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={Boolean(busy)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              loading={busy === "confirm"}
              loadingLabel="Confirming"
              onClick={async () => {
                const ok = await run("confirm", "confirm", "POST");
                if (ok) setConfirmOpen(false);
              }}
            >
              Confirm the draw
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {POT_KEYS.map((key) => (
            <div key={key} className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                Pot {key} · {props.pots[key].length} players
              </p>
              <p className="mt-1 text-sm leading-6 text-grey-200">
                {props.pots[key].map((player) => `@${player.gamerTag}`).join(", ") || "Empty"}
              </p>
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={clearOpen}
        onOpenChange={(open) => !busy && setClearOpen(open)}
        title="Clear the draft?"
        description="Every player returns to Unassigned and all pins are released. The saved shuffle seed is discarded."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setClearOpen(false)}
              disabled={Boolean(busy)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "clear"}
              loadingLabel="Clearing"
              onClick={async () => {
                const ok = await run("clear", "clear", "POST");
                if (ok) setClearOpen(false);
              }}
            >
              Clear the draft
            </Button>
          </>
        }
      >
        <p className="text-sm text-grey-300">
          The registered field itself is not changed — only the pot placements.
        </p>
      </Dialog>

      <UnconfirmDialog
        open={undoOpen}
        busy={busy === "unconfirm"}
        onOpenChange={(open) => !busy && setUndoOpen(open)}
        onConfirm={async (reason) => {
          const ok = await run("unconfirm", "unconfirm", "POST", { reason });
          if (ok) setUndoOpen(false);
        }}
      />

      <ReplacePlayerDialog
        open={replaceOpen}
        busy={busy === "replace"}
        onOpenChange={(open) => !busy && setReplaceOpen(open)}
        candidates={potList(props.pots, props.unassigned)}
        registeredIds={props.registeredIds}
        onConfirm={async (outUid, inUid, reason) => {
          const ok = await run("replace", "replace", "POST", { outUid, inUid, reason });
          if (ok) setReplaceOpen(false);
        }}
      />
    </div>
  );
}

function numericLocks(locks: PotsBoardProps["locks"]): Record<string, 1 | 2 | 3 | 4> {
  return Object.fromEntries(
    Object.entries(locks).map(([uid, pot]) => [uid, Number(pot) as 1 | 2 | 3 | 4]),
  );
}

function PlayerRow({
  player,
  pot,
  locked,
  editable,
  busy,
  onMove,
  onLock,
}: {
  readonly player: PotsBoardPlayer;
  readonly pot: PotKey | null;
  readonly locked: boolean;
  readonly editable: boolean;
  readonly busy: boolean;
  readonly onMove: (uid: string, pot: PotKey | null) => void;
  readonly onLock: (uid: string, locked: boolean) => void;
}) {
  return (
    <li className="rounded-lg border border-white/10 bg-navy-950/50 p-2">
      <div className="flex items-center gap-2">
        <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-grey-100">
            @{player.gamerTag}
          </span>
          {player.country ? (
            <span className="block truncate text-[10px] text-grey-400">
              <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
              {countryName(player.country) ?? player.country}
            </span>
          ) : null}
        </span>
        {locked ? <Lock aria-label="Pinned" className="h-3.5 w-3.5 text-gold-300" /> : null}
      </div>

      {editable ? (
        <div className="mt-2 flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`move-${player.uid}`}>
            Move @{player.gamerTag} to another pot
          </label>
          <Select
            id={`move-${player.uid}`}
            value={pot ?? "unassigned"}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              onMove(player.uid, value === "unassigned" ? null : (value as PotKey));
            }}
            className="h-8 py-1 text-xs"
          >
            <option value="unassigned">Unassigned</option>
            {POT_KEYS.map((key) => (
              <option key={key} value={key}>
                Pot {key}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => onLock(player.uid, !locked)}
            disabled={busy}
            aria-label={
              locked ? `Unpin @${player.gamerTag}` : `Pin @${player.gamerTag} to their pot`
            }
            aria-pressed={locked}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/15 text-grey-300 transition-colors hover:border-gold-400/40 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 disabled:opacity-50"
          >
            {locked ? (
              <Unlock aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : null}
    </li>
  );
}

function UnconfirmDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Undo the confirmation?"
      description="The draw returns to draft editing and the tournament returns to registration closed. Fixtures must not exist yet."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            loadingLabel="Undoing"
            disabled={busy || reason.trim().length < 5 || reason.trim().length > 300}
            onClick={() => void onConfirm(reason.trim())}
          >
            Undo confirmation
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label htmlFor="undo-reason" className="block text-sm font-medium text-grey-200">
          Reason (5-300 characters, recorded in the audit log)
        </label>
        <Textarea
          id="undo-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={301}
          placeholder="For example: a player was entered in the wrong pot."
        />
      </div>
    </Dialog>
  );
}

function ReplacePlayerDialog({
  open,
  busy,
  onOpenChange,
  candidates,
  registeredIds,
  onConfirm,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly candidates: readonly PotsBoardPlayer[];
  readonly registeredIds: readonly string[];
  readonly onConfirm: (outUid: string, inUid: string, reason: string) => Promise<void>;
}) {
  const [outUid, setOutUid] = useState("");
  const [inUid, setInUid] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly PlayerResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const term = query.trim();
  const registeredSet = useMemo(() => new Set(registeredIds), [registeredIds]);
  const visibleResults = term.length >= 2 ? results : null;
  const selected = visibleResults?.find((player) => player.uid === inUid) ?? null;

  useEffect(() => {
    if (!open || term.length < 2) {
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
        setResults((body.players ?? []).filter((player) => !registeredSet.has(player.uid)));
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
  }, [open, term, registeredSet]);

  const canSubmit =
    outUid.length > 0 &&
    inUid.length > 0 &&
    inUid !== outUid &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 300 &&
    !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Replace a player"
      description="The incoming player takes the exact pot slot of the outgoing player. The outgoing entry is removed and both players are notified."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            loadingLabel="Replacing"
            disabled={!canSubmit}
            onClick={() => void onConfirm(outUid, inUid, reason.trim())}
          >
            Replace player
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="replace-out" className="mb-1.5 block text-sm font-medium text-grey-200">
            Player to remove
          </label>
          <Select
            id="replace-out"
            value={outUid}
            onChange={(event) => setOutUid(event.target.value)}
          >
            <option value="">Choose a registered player</option>
            {candidates.map((player) => (
              <option key={player.uid} value={player.uid}>
                @{player.gamerTag}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="replace-search"
            className="mb-1.5 block text-sm font-medium text-grey-200"
          >
            Player to add
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400"
            />
            <Input
              id="replace-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setInUid("");
              }}
              placeholder="Search by gamer tag (at least 2 characters)"
              autoComplete="off"
              className="pl-10"
            />
          </div>
          {searching ? (
            <div className="mt-2">
              <Spinner size="sm" label="Searching players" />
            </div>
          ) : null}
          {visibleResults && visibleResults.length === 0 && !searching ? (
            <p className="mt-2 text-sm text-grey-400">
              No available player matches that prefix. Players already in the draw are excluded.
            </p>
          ) : null}
          {visibleResults && visibleResults.length > 0 ? (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
              {visibleResults.map((player) => (
                <li key={player.uid}>
                  <button
                    type="button"
                    onClick={() => setInUid(player.uid)}
                    aria-pressed={inUid === player.uid}
                    className={`flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                      inUid === player.uid
                        ? "border-electric-400/60 bg-electric-500/10"
                        : "border-white/10 hover:border-electric-400/30"
                    }`}
                  >
                    <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-grey-100">
                        @{player.gamerTag}
                      </span>
                      <span className="block truncate text-xs text-grey-400">
                        <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
                        {countryName(player.country) ?? player.country}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selected ? (
            <p className="mt-2 text-xs text-success-soft">
              Selected @{selected.gamerTag} for the incoming slot.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="replace-reason"
            className="mb-1.5 block text-sm font-medium text-grey-200"
          >
            Reason (5-300 characters, shown to both players and recorded)
          </label>
          <Textarea
            id="replace-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={301}
            placeholder="For example: the original player withdrew before fixtures were published."
          />
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger-soft">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
