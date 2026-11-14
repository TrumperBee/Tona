"use client";

// GCC - organiser knockout workspace.
//
// The board only sends explicit knockout actions. It never supplies a tie, a
// seed or a match id: the server draws, validates and writes the bracket. Leg
// results use the same authorised result endpoints as the league phase, and a
// level tie can only be completed with an organiser decider.
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  GitBranch,
  Loader2,
  Lock,
  Play,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export type KnockoutBoardLeg = 1 | 2;

export interface KnockoutBoardMatch {
  readonly id: string;
  readonly leg: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly status: "scheduled" | "completed";
}

export interface KnockoutBoardTie {
  readonly tieId: string;
  readonly bracketSlot: number;
  readonly legs: KnockoutBoardLeg;
  readonly higherSeedUid: string;
  readonly higherSeedTag: string;
  readonly higherSeedPosition: number;
  readonly lowerSeedUid: string;
  readonly lowerSeedTag: string;
  readonly lowerSeedPosition: number;
  readonly group: string | null;
  readonly status: "pending" | "in_progress" | "needs_decider" | "completed";
  readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly decidedBy: "aggregate" | "extra_time" | "penalties" | null;
  readonly deciderNote: string | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
  readonly matches: readonly KnockoutBoardMatch[];
}

export interface KnockoutBoardDraftTie {
  readonly tieId: string;
  readonly bracketSlot: number;
  readonly higherSeedTag: string;
  readonly higherSeedPosition: number;
  readonly lowerSeedTag: string;
  readonly lowerSeedPosition: number;
  readonly group: string | null;
}

export interface KnockoutBoardRound {
  readonly round: string;
  readonly label: string;
  readonly legs: KnockoutBoardLeg;
  readonly published: boolean;
  readonly complete: boolean;
  readonly draft: {
    readonly seed: string;
    readonly legs: KnockoutBoardLeg;
    readonly generatedAt: string;
    readonly generationCount: number;
    readonly ties: readonly KnockoutBoardDraftTie[];
  } | null;
  readonly ties: readonly KnockoutBoardTie[];
}

export interface KnockoutBoardProps {
  readonly tournamentId: string;
  readonly tournamentStatus: string;
  readonly leagueMatchesCompleted: number;
  readonly leagueMatchesTotal: number;
  readonly leagueClosed: boolean;
  readonly rounds: readonly KnockoutBoardRound[];
  readonly championTag: string | null;
  readonly runnerUpTag: string | null;
}

interface ApiBody {
  readonly error?: string;
  readonly fields?: Record<string, string>;
}

interface Notice {
  readonly tone: "success" | "danger";
  readonly message: string;
}

interface EditState {
  readonly tieId: string;
  readonly matchId: string;
  readonly mode: "enter" | "correct" | "clear";
  readonly homeTag: string;
  readonly awayTag: string;
  readonly home: string;
  readonly away: string;
  readonly reason: string;
}

interface DeciderState {
  readonly tieId: string;
  readonly higherSeedUid: string;
  readonly higherSeedTag: string;
  readonly lowerSeedUid: string;
  readonly lowerSeedTag: string;
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

function tieStatusTone(status: KnockoutBoardTie["status"]) {
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

function tieStatusLabel(status: KnockoutBoardTie["status"]): string {
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

// These row and card components live at module scope on purpose. Declaring a
// component inside another component's render body gives it a new identity on
// every render, so React unmounts and recreates its whole subtree. Any input
// inside it then loses focus after the first character (ADR-066).
interface LegRowProps {
  readonly tie: KnockoutBoardTie;
  readonly match: KnockoutBoardMatch;
  readonly onEdit: (state: EditState) => void;
}

function LegRow({ tie, match, onEdit }: LegRowProps) {
  return (
    <li className="space-y-2 rounded-lg border border-white/10 bg-navy-950/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
          Leg {match.leg} of {tie.legs}
        </span>
        <Badge tone={match.status === "completed" ? "success" : "neutral"}>
          {match.status === "completed" ? "Result" : "Due"}
        </Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <p className="truncate text-sm font-medium text-grey-100">{match.homeTag}</p>
        <span className="text-xs text-grey-500">vs</span>
        <p className="truncate text-right text-sm font-medium text-grey-100">{match.awayTag}</p>
      </div>

      {match.status === "completed" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold tabular-nums text-white">
            {match.homeGoals} – {match.awayGoals}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onEdit({
                  tieId: tie.tieId,
                  matchId: match.id,
                  mode: "correct",
                  homeTag: match.homeTag,
                  awayTag: match.awayTag,
                  home: String(match.homeGoals ?? ""),
                  away: String(match.awayGoals ?? ""),
                  reason: "",
                })
              }
            >
              Correct
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onEdit({
                  tieId: tie.tieId,
                  matchId: match.id,
                  mode: "clear",
                  homeTag: match.homeTag,
                  awayTag: match.awayTag,
                  home: "",
                  away: "",
                  reason: "",
                })
              }
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          leftIcon={<Save aria-hidden="true" className="h-3.5 w-3.5" />}
          onClick={() =>
            onEdit({
              tieId: tie.tieId,
              matchId: match.id,
              mode: "enter",
              homeTag: match.homeTag,
              awayTag: match.awayTag,
              home: "",
              away: "",
              reason: "",
            })
          }
        >
          Record leg score
        </Button>
      )}
    </li>
  );
}

interface TieCardProps {
  readonly tie: KnockoutBoardTie;
  readonly onEdit: (state: EditState) => void;
  readonly onDecider: (state: DeciderState) => void;
}

function TieCard({ tie, onEdit, onDecider }: TieCardProps) {
  const winnerTag =
    tie.winnerUid === tie.higherSeedUid
      ? tie.higherSeedTag
      : tie.winnerUid === tie.lowerSeedUid
        ? tie.lowerSeedTag
        : null;
  const isFinal = tie.legs === 1;
  const tieIdLabel = `Tie ${tie.bracketSlot}`;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            {tie.higherSeedTag} <span className="text-grey-500">vs</span> {tie.lowerSeedTag}
          </CardTitle>
          <Badge tone="neutral">{tieIdLabel}</Badge>
          {tie.group ? <Badge tone="info">Group {tie.group}</Badge> : null}
          <Badge tone={tieStatusTone(tie.status)}>{tieStatusLabel(tie.status)}</Badge>
        </div>
        <span className="text-xs tabular-nums text-grey-500">
          {tie.aggregate.higherGoals} – {tie.aggregate.lowerGoals} aggregate
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {tie.matches.map((match) => (
            <LegRow key={match.id} tie={tie} match={match} onEdit={onEdit} />
          ))}
        </div>

        {winnerTag ? (
          <p className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/[0.06] px-3 py-2 text-sm text-success-soft">
            <Trophy aria-hidden="true" className="h-4 w-4 shrink-0" />
            {winnerTag} advances
            {tie.decidedBy === "aggregate"
              ? " on aggregate"
              : tie.decidedBy === "extra_time"
                ? " after extra time"
                : tie.decidedBy === "penalties"
                  ? ` on penalties (${tie.penalties?.higher}–${tie.penalties?.lower})`
                  : ""}
            .
          </p>
        ) : null}

        {tie.status === "needs_decider" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] p-3">
            <p className="text-xs leading-5 text-warning-soft">
              Level after {tie.legsPlayed} {tie.legsPlayed === 1 ? "leg" : "legs"}. Choose the
              winner by extra time or penalties.
            </p>
            <Button
              size="sm"
              leftIcon={<Flag aria-hidden="true" className="h-3.5 w-3.5" />}
              onClick={() =>
                onDecider({
                  tieId: tie.tieId,
                  higherSeedUid: tie.higherSeedUid,
                  higherSeedTag: tie.higherSeedTag,
                  lowerSeedUid: tie.lowerSeedUid,
                  lowerSeedTag: tie.lowerSeedTag,
                  winnerUid: tie.higherSeedUid,
                  method: "extra_time",
                  note: "",
                  higherPenalties: "",
                  lowerPenalties: "",
                })
              }
            >
              Record decider
            </Button>
          </div>
        ) : null}

        {tie.status === "completed" && isFinal ? (
          <p className="text-xs text-grey-500">
            This tie completed the final. Use the completion action below to record the champion.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface RoundCardProps {
  readonly round: KnockoutBoardRound;
  readonly rounds: readonly KnockoutBoardRound[];
  readonly leagueClosed: boolean;
  readonly busy: string | null;
  readonly legs: Readonly<Record<string, KnockoutBoardLeg>>;
  readonly onSelectLegs: (round: string, legs: KnockoutBoardLeg) => void;
  readonly onDraw: (round: KnockoutBoardRound) => void;
  readonly onReset: (round: KnockoutBoardRound) => void;
  readonly onPublish: (round: string) => void;
  readonly onEdit: (state: EditState) => void;
  readonly onDecider: (state: DeciderState) => void;
}

function legsForRound(
  round: KnockoutBoardRound,
  legs: Readonly<Record<string, KnockoutBoardLeg>>,
): KnockoutBoardLeg {
  return round.round === "final" ? 1 : (legs[round.round] ?? round.legs);
}

function RoundCard({
  round,
  rounds,
  leagueClosed,
  busy,
  legs,
  onSelectLegs,
  onDraw,
  onReset,
  onPublish,
  onEdit,
  onDecider,
}: RoundCardProps) {
  const index = rounds.findIndex((entry) => entry.round === round.round);
  const previous = index > 0 ? rounds[index - 1] : null;
  const prerequisitesMet = round.round === "playoff" ? leagueClosed : Boolean(previous?.complete);
  const drawDisabled = round.published || !prerequisitesMet;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch aria-hidden="true" className="h-4 w-4 text-electric-300" />
          <CardTitle className="text-lg">{round.label}</CardTitle>
          <Badge tone="neutral">{round.legs === 1 ? "Single match" : `${round.legs} legs`}</Badge>
          {round.published ? (
            <Badge tone={round.complete ? "success" : "info"}>
              {round.complete ? "Complete" : "Published"}
            </Badge>
          ) : round.draft ? (
            <Badge tone="warning">Draft</Badge>
          ) : (
            <Badge tone="neutral">Not drawn</Badge>
          )}
        </div>

        {!round.published ? (
          <div className="flex flex-wrap items-center gap-2">
            {round.round !== "final" ? (
              <Select
                aria-label={`${round.label} leg count`}
                className="h-9 w-32"
                value={String(legsForRound(round, legs))}
                onChange={(event) =>
                  onSelectLegs(round.round, Number.parseInt(event.target.value, 10) === 1 ? 1 : 2)
                }
              >
                <option value="1">Single match</option>
                <option value="2">Two legs</option>
              </Select>
            ) : null}
            <Button
              size="sm"
              variant={round.draft ? "secondary" : "primary"}
              loading={busy === `draw-${round.round}`}
              leftIcon={<Play aria-hidden="true" className="h-3.5 w-3.5" />}
              disabled={drawDisabled}
              onClick={() => onDraw(round)}
            >
              {round.draft ? "Redraw" : "Draw round"}
            </Button>
            {round.draft ? (
              <>
                <Button
                  size="sm"
                  loading={busy === `publish-${round.round}`}
                  leftIcon={<ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />}
                  onClick={() => onPublish(round.round)}
                >
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `reset-${round.round}`}
                  leftIcon={<RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />}
                  onClick={() => onReset(round)}
                >
                  Discard
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {round.published ? (
          round.ties.length > 0 ? (
            round.ties.map((tie) => (
              <TieCard key={tie.tieId} tie={tie} onEdit={onEdit} onDecider={onDecider} />
            ))
          ) : (
            <p className="text-sm text-grey-400">No ties are published for this round yet.</p>
          )
        ) : round.draft ? (
          <>
            <p className="text-xs leading-5 text-grey-500">
              Draft generated {round.draft.generatedAt} · generation {round.draft.generationCount}.
              Nothing here is public until you publish it, and the draft can still be redrawn or
              discarded.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {round.draft.ties.map((tie) => (
                <li
                  key={tie.tieId}
                  className="rounded-lg border border-dashed border-white/15 bg-navy-950/40 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-eyebrow text-grey-500">
                    <span>Tie {tie.bracketSlot}</span>
                    {tie.group ? <span>Group {tie.group}</span> : null}
                  </div>
                  <p className="mt-1 truncate text-grey-100">
                    <span className="tabular-nums text-grey-500">{tie.higherSeedPosition}</span>{" "}
                    {tie.higherSeedTag} <span className="text-grey-500">vs</span>{" "}
                    <span className="tabular-nums text-grey-500">{tie.lowerSeedPosition}</span>{" "}
                    {tie.lowerSeedTag}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm leading-6 text-grey-400">
            {round.round === "playoff"
              ? "Draw the play-offs once the league phase is closed. Seeded positions 9–16 are paired with unseeded positions 17–24."
              : `Draw the ${round.label.toLowerCase()} after every tie in the previous round is decided.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KnockoutBoard(props: KnockoutBoardProps) {
  const refresh = useRefreshPreservingScroll();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [legs, setLegs] = useState<Record<string, KnockoutBoardLeg>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [decider, setDecider] = useState<DeciderState | null>(null);

  const leagueReady =
    props.leagueMatchesCompleted >= props.leagueMatchesTotal && props.leagueMatchesTotal > 0;

  function legsFor(round: KnockoutBoardRound): KnockoutBoardLeg {
    return round.round === "final" ? 1 : (legs[round.round] ?? round.legs);
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

  async function closeLeague(): Promise<void> {
    const done = await run(
      "close",
      `/api/organiser/tournaments/${props.tournamentId}/knockout/close-league`,
      {},
      "League phase closed. The bracket can now be drawn.",
    );

    if (done) {
      setConfirmClose(false);
    }
  }

  async function drawRound(round: KnockoutBoardRound): Promise<void> {
    await run(
      `draw-${round.round}`,
      `/api/organiser/tournaments/${props.tournamentId}/knockout/draw`,
      { round: round.round, legs: legsFor(round) },
      `${round.label} drawn. Review the draft before publishing.`,
    );
  }

  async function resetRound(round: KnockoutBoardRound): Promise<void> {
    await run(
      `reset-${round.round}`,
      `/api/organiser/tournaments/${props.tournamentId}/knockout/reset-round`,
      { round: round.round, reason: "Draft reset from the knockout workspace." },
      `${round.label} draft discarded.`,
    );
  }

  async function publishRound(round: KnockoutBoardRound): Promise<void> {
    const done = await run(
      `publish-${round.round}`,
      `/api/organiser/tournaments/${props.tournamentId}/knockout/publish`,
      { round: round.round },
      `${round.label} published. The ties are now public.`,
    );

    if (done) {
      setConfirmPublish(null);
    }
  }

  async function completeTournament(): Promise<void> {
    const done = await run(
      "complete",
      `/api/organiser/tournaments/${props.tournamentId}/knockout/complete`,
      {},
      "Tournament completed. The champion is recorded and the table stays frozen.",
    );

    if (done) {
      setConfirmComplete(false);
    }
  }

  async function submitEdit(): Promise<void> {
    if (!edit) {
      return;
    }

    if (edit.mode !== "clear") {
      const home = parseScore(edit.home);
      const away = parseScore(edit.away);

      if (home === null || away === null) {
        setNotice({ tone: "danger", message: "Enter both scores as whole numbers from 0 to 99." });
        return;
      }

      const reason = edit.reason.trim();

      if (edit.mode === "correct" && (reason.length < 5 || reason.length > 300)) {
        setNotice({
          tone: "danger",
          message: "A correction needs a reason of 5 to 300 characters.",
        });
        return;
      }

      const path =
        edit.mode === "enter"
          ? `/api/organiser/tournaments/${props.tournamentId}/results/enter`
          : `/api/organiser/tournaments/${props.tournamentId}/results/correct`;
      const body =
        edit.mode === "enter"
          ? { matchId: edit.matchId, homeGoals: home, awayGoals: away }
          : { matchId: edit.matchId, homeGoals: home, awayGoals: away, reason };
      const done = await run(
        `edit-${edit.matchId}`,
        path,
        body,
        edit.mode === "enter" ? "Leg result recorded." : "Leg result corrected and audited.",
      );

      if (done) {
        setEdit(null);
      }

      return;
    }

    const reason = edit.reason.trim();

    if (reason.length < 5 || reason.length > 300) {
      setNotice({
        tone: "danger",
        message: "Clearing a result needs a reason of 5 to 300 characters.",
      });
      return;
    }

    const done = await run(
      `edit-${edit.matchId}`,
      `/api/organiser/tournaments/${props.tournamentId}/results/clear`,
      { matchId: edit.matchId, reason },
      "Leg result cleared. The tie was recomputed.",
    );

    if (done) {
      setEdit(null);
    }
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
      "Decider recorded. The tie is complete.",
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
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy aria-hidden="true" className="h-4 w-4 text-gold-300" />
              Knockout
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-grey-400">
              Positions 1–8 go straight to the Round of 16. Positions 9–16 and 17–24 meet in the
              play-offs. Every round is drawn, validated and published by the server.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
              League results
            </p>
            <p className="font-display text-2xl font-semibold tabular-nums text-white">
              {props.leagueMatchesCompleted}
              <span className="text-sm text-grey-400"> / {props.leagueMatchesTotal}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
          {props.leagueClosed ? (
            <p className="flex items-center gap-2 text-sm text-success-soft">
              <Lock aria-hidden="true" className="h-4 w-4" />
              League phase closed. Standings are frozen for the knockout.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-grey-400">
                {leagueReady
                  ? "All 144 league results are recorded. Close the league phase to freeze the table and open the knockout."
                  : "Every league result must be recorded before the league phase can close."}
              </p>
              <Button
                disabled={!leagueReady || props.tournamentStatus !== "league_phase"}
                loading={busy === "close"}
                leftIcon={<Lock aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setConfirmClose(true)}
              >
                Close league phase
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      {props.rounds.map((round) => (
        <RoundCard
          key={round.round}
          round={round}
          rounds={props.rounds}
          leagueClosed={props.leagueClosed}
          busy={busy}
          legs={legs}
          onSelectLegs={(id, value) => setLegs((current) => ({ ...current, [id]: value }))}
          onDraw={drawRound}
          onReset={resetRound}
          onPublish={setConfirmPublish}
          onEdit={setEdit}
          onDecider={setDecider}
        />
      ))}

      {props.tournamentStatus === "knockout" &&
      props.rounds.find((round) => round.round === "final")?.complete ? (
        <Card variant="gold">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display text-lg font-semibold text-white">
                Complete the tournament
              </p>
              <p className="mt-1 text-sm text-grey-400">
                Records the champion, the runner-up and the completion time. Standings stay frozen.
              </p>
            </div>
            <Button
              loading={busy === "complete"}
              leftIcon={<Trophy aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setConfirmComplete(true)}
            >
              Complete tournament
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close the league phase?"
        description="The table is frozen and the knockout becomes available. League results can no longer be entered."
        confirmLabel="Close league phase"
        loading={busy === "close"}
        onConfirm={closeLeague}
      />

      <ConfirmDialog
        open={confirmPublish !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPublish(null);
        }}
        title="Publish this round?"
        description="The ties and their leg matches become public, and the draft is removed. A published round cannot be redrawn."
        confirmLabel="Publish round"
        loading={busy?.startsWith("publish-") ?? false}
        onConfirm={() => {
          const round = props.rounds.find((entry) => entry.round === confirmPublish);

          if (round) {
            void publishRound(round);
          }
        }}
      />

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete the tournament?"
        description="The final winner is recorded as champion and the tournament moves to completed. This is the end of the competition."
        confirmLabel="Complete tournament"
        loading={busy === "complete"}
        onConfirm={completeTournament}
      />

      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        title={
          edit?.mode === "clear"
            ? "Clear leg result"
            : edit?.mode === "correct"
              ? "Correct leg result"
              : "Record leg score"
        }
        description={edit ? `${edit.homeTag} vs ${edit.awayTag}` : null}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              variant={edit?.mode === "clear" ? "danger" : "primary"}
              loading={busy?.startsWith("edit-") ?? false}
              onClick={submitEdit}
            >
              {edit?.mode === "clear" ? "Clear result" : "Save result"}
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="space-y-4">
            {edit.mode !== "clear" ? (
              <div className="flex items-center justify-center gap-3">
                <Input
                  aria-label={`${edit.homeTag} score`}
                  inputMode="numeric"
                  maxLength={2}
                  value={edit.home}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, home: event.target.value } : current,
                    )
                  }
                  className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
                />
                <span className="font-display text-2xl text-grey-500">–</span>
                <Input
                  aria-label={`${edit.awayTag} score`}
                  inputMode="numeric"
                  maxLength={2}
                  value={edit.away}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, away: event.target.value } : current,
                    )
                  }
                  className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
                />
              </div>
            ) : null}
            {edit.mode !== "enter" ? (
              <div>
                <label
                  htmlFor="knockout-result-reason"
                  className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
                >
                  Reason (5–300 characters)
                </label>
                <Textarea
                  id="knockout-result-reason"
                  value={edit.reason}
                  maxLength={300}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, reason: event.target.value } : current,
                    )
                  }
                />
              </div>
            ) : null}
            <p className="text-xs leading-5 text-grey-500">
              Saving a leg recomputes the aggregate. A level tie stays open until a decider is
              recorded; there is no away-goals rule.
            </p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={decider !== null}
        onOpenChange={(open) => {
          if (!open) setDecider(null);
        }}
        title="Record decider"
        description={decider ? `${decider.higherSeedTag} vs ${decider.lowerSeedTag}` : null}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecider(null)}>
              Cancel
            </Button>
            <Button loading={busy?.startsWith("decide-") ?? false} onClick={submitDecider}>
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
                  { uid: decider.higherSeedUid, tag: decider.higherSeedTag },
                  { uid: decider.lowerSeedUid, tag: decider.lowerSeedTag },
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
                      name="decider-winner"
                      checked={decider.winnerUid === option.uid}
                      onChange={() =>
                        setDecider((current) =>
                          current ? { ...current, winnerUid: option.uid } : current,
                        )
                      }
                    />
                    <span className="truncate">{option.tag}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="decider-method"
                className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
              >
                Method
              </label>
              <Select
                id="decider-method"
                value={decider.method}
                onChange={(event) => {
                  const method = event.target.value === "penalties" ? "penalties" : "extra_time";
                  setDecider((current) => (current ? { ...current, method } : current));
                }}
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
                    aria-label={`${decider.higherSeedTag} penalties`}
                    inputMode="numeric"
                    maxLength={2}
                    value={decider.higherPenalties}
                    onChange={(event) =>
                      setDecider((current) =>
                        current ? { ...current, higherPenalties: event.target.value } : current,
                      )
                    }
                    className="h-12 w-16 text-center font-display text-xl font-semibold tabular-nums"
                  />
                  <span className="text-sm text-grey-500">
                    {decider.higherSeedTag} – {decider.lowerSeedTag}
                  </span>
                  <Input
                    aria-label={`${decider.lowerSeedTag} penalties`}
                    inputMode="numeric"
                    maxLength={2}
                    value={decider.lowerPenalties}
                    onChange={(event) =>
                      setDecider((current) =>
                        current ? { ...current, lowerPenalties: event.target.value } : current,
                      )
                    }
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
                htmlFor="decider-note"
                className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
              >
                Note (optional)
              </label>
              <Textarea
                id="decider-note"
                value={decider.note}
                maxLength={300}
                onChange={(event) =>
                  setDecider((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
              />
            </div>
          </div>
        ) : null}
      </Dialog>

      {busy ? (
        <p className="flex items-center gap-2 text-xs text-grey-500" aria-live="polite">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
