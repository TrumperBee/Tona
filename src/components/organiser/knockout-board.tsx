"use client";

// GCC - organiser knockout workspace.
//
// One action generates the complete bracket. Afterwards the board renders the
// same visual tree as the public page and every leg score is saved in place
// inside the tie sheet; the server advances the winner and creates the next
// matches in the same transaction. A correct or clear is refused by the server
// when a dependent tie already holds a result, and that message is surfaced
// verbatim.
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  GitBranch,
  Loader2,
  Play,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useState } from "react";

import {
  KnockoutBracket,
  toBracketRounds,
  type BracketMatchView,
  type BracketTieView,
} from "@/components/tournament/knockout-bracket";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { KNOCKOUT_ROUNDS, type KnockoutRound } from "@/lib/engine/knockout";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export interface KnockoutBoardProps {
  readonly tournamentId: string;
  readonly tournamentStatus: string;
  readonly leagueMatchesCompleted: number;
  readonly leagueMatchesTotal: number;
  readonly generated: boolean;
  readonly seed: string | null;
  readonly legs: 1 | 2 | null;
  readonly bracketHash: string | null;
  readonly ties: readonly BracketTieView[];
  readonly championTag: string | null;
  readonly runnerUpTag: string | null;
  readonly qualifiers: {
    readonly direct: number;
    readonly playoff: number;
    readonly eliminated: number;
  };
}

interface ApiBody {
  readonly error?: string;
  readonly fields?: Record<string, string>;
}

interface Notice {
  readonly tone: "success" | "danger";
  readonly message: string;
}

interface LegDraft {
  readonly home: string;
  readonly away: string;
  readonly reason: string;
}

interface DeciderState {
  readonly tieId: string;
  readonly higherUid: string;
  readonly higherTag: string;
  readonly lowerUid: string;
  readonly lowerTag: string;
  readonly winnerUid: string;
  readonly method: "extra_time" | "penalties";
  readonly note: string;
  readonly higherPenalties: string;
  readonly lowerPenalties: string;
}

function errorMessage(data: ApiBody): string {
  return (
    (data.fields && Object.values(data.fields)[0]) ??
    (typeof data.error === "string" ? data.error : "That action did not complete. Try again.")
  );
}

async function sendJson(path: string, body: unknown): Promise<{ ok: boolean; data: ApiBody }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as ApiBody;

    return { ok: response.ok, data };
  } catch {
    return {
      ok: false,
      data: { error: "The connection failed. Check your network and try again." },
    };
  }
}

function parseScore(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{1,2}$/.test(trimmed)) {
    return null;
  }

  const number = Number.parseInt(trimmed, 10);
  return number >= 0 && number <= 99 ? number : null;
}

function tieLabel(tie: BracketTieView): string {
  if (tie.group) {
    const match = /^playoff-([a-d])(\d)$/.exec(tie.tieId);
    return `Play-off ${match?.[1]?.toUpperCase() ?? tie.group}${match?.[2] ?? ""}`;
  }

  return `${tie.roundLabel} · tie ${tie.bracketSlot}`;
}

function slotName(tie: BracketTieView, slot: "higher" | "lower"): string {
  const side = tie[slot];
  return side.uid ? (side.gamerTag ?? "Player") : side.source;
}

function statusTone(status: BracketTieView["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "needs_decider":
      return "warning" as const;
    case "in_progress":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function statusLabel(status: BracketTieView["status"]): string {
  switch (status) {
    case "completed":
      return "Decided";
    case "needs_decider":
      return "Needs decider";
    case "in_progress":
      return "In progress";
    default:
      return "Pending";
  }
}

interface LegEditorProps {
  readonly tie: BracketTieView;
  readonly match: BracketMatchView;
  readonly draft: LegDraft;
  readonly busy: string | null;
  readonly onDraftChange: (matchId: string, patch: Partial<LegDraft>) => void;
  readonly onSave: (match: BracketMatchView, draft: LegDraft) => void;
  readonly onClear: (match: BracketMatchView, draft: LegDraft) => void;
}

function LegEditor({ tie, match, draft, busy, onDraftChange, onSave, onClear }: LegEditorProps) {
  const completed = match.status === "completed";
  const saving = busy === `leg-${match.id}`;

  return (
    <li className="space-y-3 rounded-lg border border-white/10 bg-navy-950/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
          Leg {match.leg} of {tie.legs}
        </span>
        <Badge tone={completed ? "success" : "neutral"}>{completed ? "Result" : "Due"}</Badge>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
        <span className="truncate text-sm text-grey-100">{match.homeTag}</span>
        <Input
          aria-label={`${match.homeTag} goals`}
          inputMode="numeric"
          maxLength={2}
          value={draft.home}
          onChange={(event) => onDraftChange(match.id, { home: event.target.value })}
          className="h-10 w-14 text-center font-display text-lg font-semibold tabular-nums"
        />
        <span className="truncate text-sm text-grey-100">{match.awayTag}</span>
        <Input
          aria-label={`${match.awayTag} goals`}
          inputMode="numeric"
          maxLength={2}
          value={draft.away}
          onChange={(event) => onDraftChange(match.id, { away: event.target.value })}
          className="h-10 w-14 text-center font-display text-lg font-semibold tabular-nums"
        />
      </div>
      <p className="text-[11px] text-grey-500">
        {match.homeTag} hosts this leg. The higher-ranked player hosts the second leg and is listed
        first in a single match.
      </p>

      {completed ? (
        <div>
          <label
            htmlFor={`leg-reason-${match.id}`}
            className="mb-1 block text-[11px] font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            Reason (5–300 characters, required)
          </label>
          <Textarea
            id={`leg-reason-${match.id}`}
            value={draft.reason}
            maxLength={300}
            onChange={(event) => onDraftChange(match.id, { reason: event.target.value })}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          loading={saving}
          leftIcon={<Save aria-hidden="true" className="h-3.5 w-3.5" />}
          onClick={() => onSave(match, draft)}
        >
          {completed ? "Save correction" : "Save score"}
        </Button>
        {completed ? (
          <Button
            size="sm"
            variant="ghost"
            loading={saving}
            leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
            onClick={() => onClear(match, draft)}
          >
            Clear result
          </Button>
        ) : null}
      </div>
    </li>
  );
}

interface DeciderDialogProps {
  readonly decider: DeciderState | null;
  readonly busy: boolean;
  readonly onChange: (patch: Partial<DeciderState>) => void;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

function DeciderDialog({ decider, busy, onChange, onClose, onConfirm }: DeciderDialogProps) {
  return (
    <Dialog
      open={decider !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Record decider"
      description={decider ? `${decider.higherTag} vs ${decider.lowerTag}` : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={onConfirm}>
            Save decider
          </Button>
        </>
      }
    >
      {decider ? (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              Winner
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { uid: decider.higherUid, tag: decider.higherTag },
                { uid: decider.lowerUid, tag: decider.lowerTag },
              ].map((option) => (
                <label
                  key={option.uid}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                    decider.winnerUid === option.uid
                      ? "border-electric-400/40 bg-electric-500/[0.08] text-white"
                      : "border-white/10 bg-navy-950/40 text-grey-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="knockout-decider-winner"
                    checked={decider.winnerUid === option.uid}
                    onChange={() => onChange({ winnerUid: option.uid })}
                  />
                  <span className="truncate">{option.tag}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="knockout-decider-method"
              className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
            >
              Method
            </label>
            <Select
              id="knockout-decider-method"
              value={decider.method}
              onChange={(event) =>
                onChange({
                  method: event.target.value === "penalties" ? "penalties" : "extra_time",
                })
              }
            >
              <option value="extra_time">Extra time</option>
              <option value="penalties">Penalties</option>
            </Select>
          </div>

          {decider.method === "penalties" ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                Penalty score
              </p>
              <div className="flex items-center justify-center gap-3">
                <Input
                  aria-label={`${decider.higherTag} penalties`}
                  inputMode="numeric"
                  maxLength={2}
                  value={decider.higherPenalties}
                  onChange={(event) => onChange({ higherPenalties: event.target.value })}
                  className="h-12 w-16 text-center font-display text-xl font-semibold tabular-nums"
                />
                <span className="text-sm text-grey-500">
                  {decider.higherTag} – {decider.lowerTag}
                </span>
                <Input
                  aria-label={`${decider.lowerTag} penalties`}
                  inputMode="numeric"
                  maxLength={2}
                  value={decider.lowerPenalties}
                  onChange={(event) => onChange({ lowerPenalties: event.target.value })}
                  className="h-12 w-16 text-center font-display text-xl font-semibold tabular-nums"
                />
              </div>
              <p className="mt-2 text-xs text-grey-500">
                The shoot-out score must agree with the selected winner and cannot be level.
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="knockout-decider-note"
              className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
            >
              Note (optional)
            </label>
            <Textarea
              id="knockout-decider-note"
              value={decider.note}
              maxLength={300}
              onChange={(event) => onChange({ note: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

export function KnockoutBoard(props: KnockoutBoardProps) {
  const refresh = useRefreshPreservingScroll();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateLegs, setGenerateLegs] = useState<"1" | "2">("2");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [selectedTieId, setSelectedTieId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LegDraft>>({});
  const [decider, setDecider] = useState<DeciderState | null>(null);

  const leagueReady =
    props.leagueMatchesTotal > 0 && props.leagueMatchesCompleted >= props.leagueMatchesTotal;
  const canGenerate = !props.generated && leagueReady && props.tournamentStatus === "league_phase";
  const selectedTie = props.ties.find((tie) => tie.tieId === selectedTieId) ?? null;
  const hasKnockoutResult = props.ties.some(
    (tie) => tie.legsPlayed > 0 || tie.status !== "pending",
  );
  const canReset = props.generated && props.tournamentStatus === "knockout" && !hasKnockoutResult;
  const rounds = toBracketRounds(props.ties, KNOCKOUT_ROUNDS as readonly KnockoutRound[]);

  function draftFor(match: BracketMatchView): LegDraft {
    return (
      drafts[match.id] ?? {
        home: match.homeGoals === null ? "" : String(match.homeGoals),
        away: match.awayGoals === null ? "" : String(match.awayGoals),
        reason: "",
      }
    );
  }

  function updateDraft(matchId: string, patch: Partial<LegDraft>): void {
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? { home: "", away: "", reason: "" }),
        ...patch,
      },
    }));
  }

  async function run(key: string, path: string, body: unknown, success: string): Promise<boolean> {
    setBusy(key);
    const result = await sendJson(path, body);
    setBusy(null);

    if (!result.ok) {
      setNotice({ tone: "danger", message: errorMessage(result.data) });
      return false;
    }

    setNotice({ tone: "success", message: success });
    refresh();
    return true;
  }

  async function generate(): Promise<void> {
    const done = await run(
      "generate",
      `/api/organiser/tournaments/${props.tournamentId}/knockout/generate`,
      { legs: Number.parseInt(generateLegs, 10) },
      "Knockout stage generated. Every tie is live and the bracket advances automatically.",
    );

    if (done) {
      setGenerateOpen(false);
    }
  }

  async function reset(): Promise<void> {
    const reason = resetReason.trim();

    if (reason.length < 3 || reason.length > 500) {
      setNotice({
        tone: "danger",
        message: "Resetting the bracket needs a reason of 3 to 500 characters.",
      });
      return;
    }

    const done = await run(
      "reset",
      `/api/organiser/tournaments/${props.tournamentId}/knockout/reset`,
      { reason },
      "Knockout stage reset. The tournament is back in the league phase.",
    );

    if (done) {
      setResetOpen(false);
      setResetReason("");
      setSelectedTieId(null);
    }
  }

  async function saveLeg(
    tie: BracketTieView,
    match: BracketMatchView,
    draft: LegDraft,
    action: "save" | "clear",
  ): Promise<void> {
    const id = props.tournamentId;
    const reason = draft.reason.trim();

    if (action === "save") {
      const home = parseScore(draft.home);
      const away = parseScore(draft.away);

      if (home === null || away === null) {
        setNotice({ tone: "danger", message: "Enter both scores as whole numbers from 0 to 99." });
        return;
      }

      if (match.status === "completed" && (reason.length < 5 || reason.length > 300)) {
        setNotice({
          tone: "danger",
          message: "A correction needs a reason of 5 to 300 characters.",
        });
        return;
      }

      const entered = await run(
        `leg-${match.id}`,
        match.status === "completed"
          ? `/api/organiser/tournaments/${id}/results/correct`
          : `/api/organiser/tournaments/${id}/results/enter`,
        match.status === "completed"
          ? { matchId: match.id, homeGoals: home, awayGoals: away, reason }
          : { matchId: match.id, homeGoals: home, awayGoals: away },
        match.status === "completed"
          ? "Leg corrected. The tie and every dependent slot were recomputed."
          : "Leg score recorded. The tie was recomputed.",
      );

      if (entered) {
        setDrafts((current) => ({
          ...current,
          [match.id]: { home: String(home), away: String(away), reason: "" },
        }));
      }

      return;
    }

    if (reason.length < 5 || reason.length > 300) {
      setNotice({
        tone: "danger",
        message: "Clearing a result needs a reason of 5 to 300 characters.",
      });
      return;
    }

    const cleared = await run(
      `leg-${match.id}`,
      `/api/organiser/tournaments/${id}/results/clear`,
      { matchId: match.id, reason },
      "Leg result cleared. The tie was recomputed.",
    );

    if (cleared) {
      setDrafts((current) => ({
        ...current,
        [match.id]: { home: "", away: "", reason: "" },
      }));
    }

    void tie;
  }

  function openDecider(tie: BracketTieView): void {
    if (!tie.higher.uid || !tie.lower.uid) {
      return;
    }

    setDecider({
      tieId: tie.tieId,
      higherUid: tie.higher.uid,
      higherTag: tie.higher.gamerTag ?? "Player",
      lowerUid: tie.lower.uid,
      lowerTag: tie.lower.gamerTag ?? "Player",
      winnerUid: tie.higher.uid,
      method: "extra_time",
      note: "",
      higherPenalties: "",
      lowerPenalties: "",
    });
  }

  async function submitDecider(): Promise<void> {
    if (!decider) {
      return;
    }

    const note = decider.note.trim();
    let penalties: { higher: number; lower: number } | undefined;

    if (decider.method === "penalties") {
      const higher = parseScore(decider.higherPenalties);
      const lower = parseScore(decider.lowerPenalties);

      if (higher === null || lower === null) {
        setNotice({ tone: "danger", message: "Enter both penalty scores as whole numbers." });
        return;
      }

      if (higher === lower) {
        setNotice({ tone: "danger", message: "A penalty shoot-out cannot end level." });
        return;
      }

      penalties = { higher, lower };
    }

    const done = await run(
      `decide-${decider.tieId}`,
      `/api/organiser/tournaments/${props.tournamentId}/knockout/ties/${decider.tieId}/decide`,
      {
        winnerUid: decider.winnerUid,
        method: decider.method,
        ...(note.length > 0 ? { note } : {}),
        ...(penalties ? { penalties } : {}),
      },
      "Decider recorded. The winner was written into the next round.",
    );

    if (done) {
      setDecider(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            notice.tone === "success"
              ? "border-success/30 bg-success/[0.06] text-success-soft"
              : "border-danger/30 bg-danger/[0.06] text-danger-soft"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{notice.message}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy aria-hidden="true" className="h-4 w-4 text-gold-300" />
              Knockout stage
            </CardTitle>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-grey-400">
              Positions 1–8 go straight to the Round of 16. Positions 9–24 meet in the play-offs,
              seeded against unseeded inside each group. One action builds all 23 ties; winners
              advance automatically.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
              League results
            </p>
            <p className="font-display text-2xl font-semibold tabular-nums text-white">
              {props.leagueMatchesCompleted}
              <span className="text-sm text-grey-400"> / {props.leagueMatchesTotal}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-electric-400"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (props.leagueMatchesCompleted / Math.max(props.leagueMatchesTotal, 1)) * 100,
                  ),
                )}%`,
              }}
            />
          </div>

          {props.generated ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-grey-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-success" />
                Bracket locked
              </span>
              <span>
                Legs before the final: <span className="text-grey-300">{props.legs ?? "–"}</span>
              </span>
              <span>
                Final: <span className="text-grey-300">single match</span>
              </span>
              {props.bracketHash ? (
                <span className="font-mono text-[11px] text-grey-600">
                  hash {props.bracketHash.slice(0, 12)}
                </span>
              ) : null}
              {props.seed ? (
                <span className="font-mono text-[11px] text-grey-600">
                  seed {props.seed.slice(0, 8)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-grey-400">
                {!leagueReady
                  ? `Record every league result first. ${Math.max(
                      props.leagueMatchesTotal - props.leagueMatchesCompleted,
                      0,
                    )} still outstanding.`
                  : props.tournamentStatus !== "league_phase"
                    ? "The tournament is no longer in the league phase, so the bracket cannot be generated."
                    : "All league results are recorded. Generate the complete bracket in one step."}
              </p>
              <Button
                disabled={!canGenerate}
                loading={busy === "generate"}
                leftIcon={<Play aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setGenerateOpen(true)}
              >
                Generate knockout stage
              </Button>
            </div>
          )}

          {props.championTag ? (
            <div className="rounded-lg border border-gold-400/25 bg-gold-400/[0.05] p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-gold-200">
                <Trophy aria-hidden="true" className="h-4 w-4" />
                Champion: {props.championTag}
              </p>
              {props.runnerUpTag ? (
                <p className="mt-1 text-xs text-grey-400">Runner-up: {props.runnerUpTag}</p>
              ) : null}
              <p className="mt-1 text-xs text-grey-500">
                The final result completed the tournament automatically. The league table stays
                frozen.
              </p>
            </div>
          ) : null}

          {props.generated && !props.championTag ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-navy-950/40 p-3">
              <p className="text-xs leading-5 text-grey-400">
                {canReset
                  ? "No knockout result exists yet. Resetting deletes the bracket and returns the tournament to the league phase."
                  : "Reset is unavailable once any knockout result exists. Correct the affected leg instead."}
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canReset}
                loading={busy === "reset"}
                leftIcon={<RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />}
                onClick={() => setResetOpen(true)}
              >
                Reset knockout stage
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {props.generated ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch aria-hidden="true" className="h-4 w-4 text-electric-300" />
              Bracket
            </CardTitle>
            <p className="mt-1 text-sm text-grey-400">
              Tap a tie to record leg scores, clear a result or settle a level tie. Later ties show
              what they are waiting for.
            </p>
          </CardHeader>
          <CardContent>
            <KnockoutBracket rounds={rounds} onSelectTie={(tie) => setSelectedTieId(tie.tieId)} />
          </CardContent>
        </Card>
      ) : null}

      <BottomSheet
        open={selectedTie !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTieId(null);
          }
        }}
        title={selectedTie ? tieLabel(selectedTie) : "Tie"}
        description={
          selectedTie
            ? `${slotName(selectedTie, "higher")} vs ${slotName(selectedTie, "lower")}`
            : null
        }
      >
        {selectedTie ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selectedTie.status)}>{statusLabel(selectedTie.status)}</Badge>
              <Badge tone="neutral">
                {selectedTie.legs === 1 ? "Single match" : `${selectedTie.legs} legs`}
              </Badge>
              {selectedTie.complete ? (
                <Badge tone="success">{selectedTie.winnerTag} advances</Badge>
              ) : null}
            </div>

            <div className="rounded-lg border border-white/10 bg-navy-950/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-grey-100">
                  {slotName(selectedTie, "higher")}
                </span>
                <span className="font-display text-lg font-semibold tabular-nums text-white">
                  {selectedTie.legsPlayed > 0 ? selectedTie.aggregate.higherGoals : "–"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-grey-100">
                  {slotName(selectedTie, "lower")}
                </span>
                <span className="font-display text-lg font-semibold tabular-nums text-white">
                  {selectedTie.legsPlayed > 0 ? selectedTie.aggregate.lowerGoals : "–"}
                </span>
              </div>
              <p className="mt-1 text-xs text-grey-500">
                {selectedTie.legsPlayed > 0
                  ? `Aggregate after ${selectedTie.legsPlayed} ${
                      selectedTie.legsPlayed === 1 ? "leg" : "legs"
                    }`
                  : "No leg has been played yet."}
              </p>
            </div>

            {!selectedTie.higher.uid || !selectedTie.lower.uid ? (
              <p className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-xs leading-5 text-grey-400">
                Waiting for{" "}
                {!selectedTie.higher.uid ? selectedTie.higher.source : selectedTie.lower.source}.
                The matches are created automatically as soon as the feeding tie is decided.
              </p>
            ) : selectedTie.matches.length > 0 ? (
              <ul className="space-y-2">
                {selectedTie.matches.map((match) => (
                  <LegEditor
                    key={match.id}
                    tie={selectedTie}
                    match={match}
                    draft={draftFor(match)}
                    busy={busy}
                    onDraftChange={updateDraft}
                    onSave={(entry, draft) => {
                      void saveLeg(selectedTie, entry, draft, "save");
                    }}
                    onClear={(entry, draft) => {
                      void saveLeg(selectedTie, entry, draft, "clear");
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-xs leading-5 text-grey-400">
                No match documents exist yet for this tie.
              </p>
            )}

            {selectedTie.decidedBy ? (
              <p className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-xs leading-5 text-grey-400">
                Decided by {selectedTie.decidedBy.replace("_", " ")}
                {selectedTie.penalties
                  ? ` · shoot-out ${selectedTie.penalties.higher}–${selectedTie.penalties.lower}`
                  : ""}
                {selectedTie.deciderNote ? ` · ${selectedTie.deciderNote}` : ""}
              </p>
            ) : null}

            {selectedTie.status === "needs_decider" ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] p-3">
                <p className="text-xs leading-5 text-warning-soft">
                  Level after {selectedTie.legsPlayed}{" "}
                  {selectedTie.legsPlayed === 1 ? "leg" : "legs"}. Record the winner by extra time
                  or penalties.
                </p>
                <Button
                  size="sm"
                  leftIcon={<Flag aria-hidden="true" className="h-3.5 w-3.5" />}
                  onClick={() => openDecider(selectedTie)}
                >
                  Record decider
                </Button>
              </div>
            ) : null}

            {selectedTie.complete ? (
              <p className="text-xs leading-5 text-grey-500">
                {selectedTie.winnerTag} was written into every dependent slot in the same
                transaction. A later correction is only possible while no dependent tie has a
                result.
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <Dialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Generate knockout stage"
        description="One transaction freezes the league table, draws and validates all 23 ties and publishes the bracket."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy === "generate"} disabled={!canGenerate} onClick={generate}>
              Generate bracket
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="knockout-generate-legs"
              className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
            >
              Legs before the final
            </label>
            <Select
              id="knockout-generate-legs"
              value={generateLegs}
              onChange={(event) => setGenerateLegs(event.target.value === "1" ? "1" : "2")}
            >
              <option value="2">Two legs (play-offs, R16, QF, SF)</option>
              <option value="1">Single match every round</option>
            </Select>
            <p className="mt-1 text-xs leading-5 text-grey-500">
              The final is always one match. In a two-legged tie the lower-ranked player hosts the
              first leg and the higher-ranked player hosts the second.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-navy-950/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              Who qualifies
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-grey-300">
              <li className="flex items-center justify-between gap-2">
                <span>Direct to the Round of 16</span>
                <span className="tabular-nums text-white">{props.qualifiers.direct}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Into the play-offs (seeded 9–16 vs unseeded 17–24)</span>
                <span className="tabular-nums text-white">{props.qualifiers.playoff}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Eliminated</span>
                <span className="tabular-nums text-white">{props.qualifiers.eliminated}</span>
              </li>
            </ul>
          </div>

          <p className="text-xs leading-5 text-grey-500">
            The server re-reads every league result before drawing. The seed and bracket hash are
            stored, so the draw can be replayed and verified. This bracket follows the GCC
            competition rules; it is not a copy of any real-world competition path.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset knockout stage?"
        description="Deletes all 23 ties and their matches and returns the tournament to the league phase. Only possible before any knockout result exists."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "reset"}
              disabled={!canReset}
              onClick={reset}
            >
              Reset bracket
            </Button>
          </>
        }
      >
        <div>
          <label
            htmlFor="knockout-reset-reason"
            className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            Reason (3–500 characters)
          </label>
          <Textarea
            id="knockout-reset-reason"
            value={resetReason}
            maxLength={500}
            onChange={(event) => setResetReason(event.target.value)}
          />
        </div>
      </Dialog>

      <DeciderDialog
        decider={decider}
        busy={busy?.startsWith("decide-") ?? false}
        onChange={(patch) =>
          setDecider((current) => (current ? { ...current, ...patch } : current))
        }
        onClose={() => setDecider(null)}
        onConfirm={submitDecider}
      />

      {busy ? (
        <p className="flex items-center gap-2 text-xs text-grey-500" aria-live="polite">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
