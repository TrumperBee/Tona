"use client";

// GCC - organiser result entry, correction and clearing.
//
// Two bounded flows share one server module: find a registered player and pick
// one of their eight fixtures, or work through the eighteen fixtures on one
// matchday and save them in a single all-or-nothing batch. Nothing here submits
// a result as a player; every request is an authorised organiser action.
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  Pencil,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlayerCombobox, type ComboboxPlayer } from "@/components/organiser/player-combobox";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils/dates";

export interface ResultsBoardMatch {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "completed";
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly enteredBy: string | null;
  readonly enteredByTag: string | null;
  readonly enteredAt: string | null;
  readonly lastEditedBy: string | null;
  readonly lastEditedByTag: string | null;
  readonly lastEditedAt: string | null;
  readonly editCount: number;
}

export interface ResultsBoardProps {
  readonly tournamentId: string;
  readonly timezone: string;
  readonly matches: readonly ResultsBoardMatch[];
  readonly players: readonly ComboboxPlayer[];
  readonly initialMatchId: string | null;
}

interface ApiBody {
  readonly error?: string;
  readonly fields?: Record<string, string>;
  readonly recorded?: number;
}

interface ScorePair {
  home: string;
  away: string;
}

interface Notice {
  readonly tone: "success" | "danger";
  readonly message: string;
}

const EMPTY_SCORE: ScorePair = { home: "", away: "" };

function scorePair(match: ResultsBoardMatch): ScorePair {
  return {
    home: match.homeGoals === null ? "" : String(match.homeGoals),
    away: match.awayGoals === null ? "" : String(match.awayGoals),
  };
}

function parseScore(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{1,2}$/.test(trimmed)) {
    return null;
  }

  const number = Number.parseInt(trimmed, 10);
  return number >= 0 && number <= 99 ? number : null;
}

function scoreLabel(match: ResultsBoardMatch): string {
  return match.homeGoals !== null && match.awayGoals !== null
    ? `${match.homeTag} ${match.homeGoals} - ${match.awayGoals} ${match.awayTag}`
    : `${match.homeTag} vs ${match.awayTag}`;
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

function MatchMeta({ match }: { readonly match: ResultsBoardMatch }) {
  if (match.status !== "completed") {
    return <Badge tone="neutral">Not played</Badge>;
  }

  return (
    <div className="space-y-1 text-[11px] leading-5 text-grey-500">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">Completed</Badge>
        {match.editCount > 0 ? <Badge tone="warning">Edited {match.editCount}×</Badge> : null}
      </div>
      {match.enteredByTag ? (
        <p>
          Entered by {match.enteredByTag}
          {match.enteredAt ? ` · ${formatDate(match.enteredAt)}` : ""}
        </p>
      ) : null}
      {match.lastEditedByTag ? (
        <p>
          Corrected by {match.lastEditedByTag}
          {match.lastEditedAt ? ` · ${formatDate(match.lastEditedAt)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function ResultsBoard(props: ResultsBoardProps) {
  const router = useRouter();
  const initialMatch = props.initialMatchId
    ? (props.matches.find((match) => match.id === props.initialMatchId) ?? null)
    : null;
  const [selectedUid, setSelectedUid] = useState<string>(
    initialMatch
      ? initialMatch.homeUid === initialMatch.awayUid
        ? initialMatch.homeUid
        : props.players.some((player) => player.uid === initialMatch.homeUid)
          ? initialMatch.homeUid
          : initialMatch.awayUid
      : "",
  );
  const [panelMatchId, setPanelMatchId] = useState<string | null>(initialMatch?.id ?? null);
  const [singleScore, setSingleScore] = useState<ScorePair>(
    initialMatch ? scorePair(initialMatch) : EMPTY_SCORE,
  );
  const [gridMatchday, setGridMatchday] = useState(1);
  const [gridScores, setGridScores] = useState<Record<string, ScorePair>>({});
  const [confirmEnter, setConfirmEnter] = useState<ResultsBoardMatch | null>(null);
  const [correctMatch, setCorrectMatch] = useState<ResultsBoardMatch | null>(null);
  const [correctScore, setCorrectScore] = useState<ScorePair>(EMPTY_SCORE);
  const [correctReason, setCorrectReason] = useState("");
  const [clearMatch, setClearMatch] = useState<ResultsBoardMatch | null>(null);
  const [clearReason, setClearReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const selectedPlayer = props.players.find((player) => player.uid === selectedUid) ?? null;
  const playerMatches = props.matches
    .filter(
      (match) =>
        selectedUid.length > 0 && (match.homeUid === selectedUid || match.awayUid === selectedUid),
    )
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "scheduled" ? -1 : 1;
      }

      if (a.matchday !== b.matchday) return a.matchday - b.matchday;
      return a.id < b.id ? -1 : 1;
    });
  const panelMatch = props.matches.find((match) => match.id === panelMatchId) ?? null;
  const matchdayMatches = props.matches.filter((match) => match.matchday === gridMatchday);
  const pendingGridCount = matchdayMatches.filter((match) => {
    const entry = gridScores[match.id];
    return (
      match.status === "scheduled" &&
      entry !== undefined &&
      (entry.home.trim().length > 0 || entry.away.trim().length > 0)
    );
  }).length;

  function selectPlayer(uid: string): void {
    setSelectedUid(uid);
    setPanelMatchId(null);
    setSingleScore(EMPTY_SCORE);
    setNotice(null);
  }

  function selectPanelMatch(match: ResultsBoardMatch): void {
    setPanelMatchId(match.id);
    setSingleScore(scorePair(match));
    setNotice(null);
  }

  async function submitEnter(): Promise<void> {
    if (!confirmEnter) return;
    const home = parseScore(singleScore.home);
    const away = parseScore(singleScore.away);

    if (home === null || away === null) {
      setNotice({ tone: "danger", message: "Enter both scores as whole numbers from 0 to 99." });
      setConfirmEnter(null);
      return;
    }

    setBusy("enter");
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/results/enter`,
      { matchId: confirmEnter.id, homeGoals: home, awayGoals: away },
    );
    setBusy(null);
    setConfirmEnter(null);

    if (!result.ok) {
      setNotice({ tone: "danger", message: errorMessage(result.data) });
      return;
    }

    setNotice({ tone: "success", message: "Result recorded." });
    setSingleScore(EMPTY_SCORE);
    router.refresh();
  }

  async function submitCorrect(): Promise<void> {
    if (!correctMatch) return;
    const home = parseScore(correctScore.home);
    const away = parseScore(correctScore.away);
    const reason = correctReason.trim();

    if (home === null || away === null) {
      setNotice({ tone: "danger", message: "Enter both scores as whole numbers from 0 to 99." });
      return;
    }

    if (reason.length < 5 || reason.length > 300) {
      setNotice({ tone: "danger", message: "Give a reason of 5 to 300 characters." });
      return;
    }

    setBusy("correct");
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/results/correct`,
      { matchId: correctMatch.id, homeGoals: home, awayGoals: away, reason },
    );
    setBusy(null);

    if (!result.ok) {
      setNotice({ tone: "danger", message: errorMessage(result.data) });
      return;
    }

    setCorrectMatch(null);
    setCorrectReason("");
    setSingleScore(EMPTY_SCORE);
    setNotice({ tone: "success", message: "Result corrected and audited." });
    router.refresh();
  }

  async function submitClear(): Promise<void> {
    if (!clearMatch) return;
    const reason = clearReason.trim();

    if (reason.length < 5 || reason.length > 300) {
      setNotice({ tone: "danger", message: "Give a reason of 5 to 300 characters." });
      return;
    }

    setBusy("clear");
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/results/clear`,
      { matchId: clearMatch.id, reason },
    );
    setBusy(null);

    if (!result.ok) {
      setNotice({ tone: "danger", message: errorMessage(result.data) });
      return;
    }

    setClearMatch(null);
    setClearReason("");
    setSingleScore(EMPTY_SCORE);
    setNotice({ tone: "success", message: "Result cleared; the fixture is scheduled again." });
    router.refresh();
  }

  async function submitBulk(): Promise<void> {
    const results: Array<{ matchId: string; homeGoals: number; awayGoals: number }> = [];

    for (const match of matchdayMatches) {
      if (match.status !== "scheduled") continue;
      const entry = gridScores[match.id];

      if (!entry || (entry.home.trim().length === 0 && entry.away.trim().length === 0)) {
        continue;
      }

      const home = parseScore(entry.home);
      const away = parseScore(entry.away);

      if (home === null || away === null) {
        setNotice({
          tone: "danger",
          message: `Enter both scores for ${match.homeTag} vs ${match.awayTag}, or leave both blank.`,
        });
        return;
      }

      results.push({ matchId: match.id, homeGoals: home, awayGoals: away });
    }

    if (results.length === 0) {
      setNotice({ tone: "danger", message: "Enter at least one result to save." });
      return;
    }

    setBusy("bulk");
    const result = await sendJson(`/api/organiser/tournaments/${props.tournamentId}/results/bulk`, {
      results: results.slice(0, 18),
    });
    setBusy(null);

    if (!result.ok) {
      setNotice({ tone: "danger", message: errorMessage(result.data) });
      return;
    }

    setGridScores({});
    setNotice({
      tone: "success",
      message: `${result.data.recorded ?? results.length} results recorded in one transaction.`,
    });
    router.refresh();
  }

  const playerTab = (
    <div className="space-y-5">
      <PlayerCombobox
        players={props.players}
        selectedUid={selectedUid || null}
        onSelect={selectPlayer}
      />

      {selectedPlayer ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardHeader className="flex items-center gap-3">
              <Avatar name={selectedPlayer.gamerTag} src={selectedPlayer.avatarUrl} size="sm" />
              <div>
                <CardTitle className="text-lg">{selectedPlayer.gamerTag}</CardTitle>
                <p className="mt-0.5 text-xs text-grey-500">
                  {playerMatches.length} fixtures · unplayed first
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-white/10">
                {playerMatches.map((match) => {
                  const opponent = match.homeUid === selectedUid ? match.awayTag : match.homeTag;
                  const home = match.homeUid === selectedUid;

                  return (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => selectPanelMatch(match)}
                        className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 ${
                          panelMatchId === match.id ? "bg-electric-500/[0.07]" : ""
                        }`}
                      >
                        <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                          MD {match.matchday}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-grey-100">
                            {opponent}
                          </span>
                          <span className="text-xs text-grey-500">
                            {home ? "Home" : "Away"} ·{" "}
                            {match.status === "completed"
                              ? `${match.homeGoals}–${match.awayGoals}`
                              : "Not played"}
                          </span>
                        </span>
                        <Badge tone={match.status === "completed" ? "success" : "neutral"}>
                          {match.status === "completed" ? "Result" : "Due"}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Result entry</CardTitle>
            </CardHeader>
            <CardContent>
              {!panelMatch ? (
                <p className="text-sm leading-6 text-grey-400">
                  Pick a fixture from the list to record, correct or clear its result.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-white/10 bg-navy-950/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                      Matchday {panelMatch.matchday} ·{" "}
                      {panelMatch.scheduledAt
                        ? formatDate(panelMatch.scheduledAt, { timeZone: props.timezone })
                        : "Date to be confirmed"}
                    </p>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <p className="truncate text-right text-sm font-semibold text-grey-100">
                        {panelMatch.homeTag}
                      </p>
                      <span className="text-xs font-semibold text-grey-500">vs</span>
                      <p className="truncate text-sm font-semibold text-grey-100">
                        {panelMatch.awayTag}
                      </p>
                    </div>
                  </div>

                  {panelMatch.status === "scheduled" ? (
                    <>
                      <div className="flex items-center justify-center gap-3">
                        <label className="sr-only" htmlFor="single-home-score">
                          {panelMatch.homeTag} score
                        </label>
                        <Input
                          id="single-home-score"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={singleScore.home}
                          onChange={(event) =>
                            setSingleScore((current) => ({ ...current, home: event.target.value }))
                          }
                          className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
                        />
                        <span className="font-display text-2xl text-grey-500">–</span>
                        <label className="sr-only" htmlFor="single-away-score">
                          {panelMatch.awayTag} score
                        </label>
                        <Input
                          id="single-away-score"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={singleScore.away}
                          onChange={(event) =>
                            setSingleScore((current) => ({ ...current, away: event.target.value }))
                          }
                          className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
                        />
                      </div>
                      <Button
                        className="w-full"
                        loading={busy === "enter"}
                        leftIcon={<Save aria-hidden="true" className="h-4 w-4" />}
                        onClick={() => setConfirmEnter(panelMatch)}
                      >
                        Save result
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-success/25 bg-success/[0.06] p-4 text-center">
                        <p className="font-display text-3xl font-semibold tabular-nums text-white">
                          {panelMatch.homeGoals} – {panelMatch.awayGoals}
                        </p>
                        <p className="mt-1 text-xs text-grey-400">Recorded result</p>
                      </div>
                      <MatchMeta match={panelMatch} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                          onClick={() => {
                            setCorrectMatch(panelMatch);
                            setCorrectScore(scorePair(panelMatch));
                            setCorrectReason("");
                          }}
                        >
                          Correct
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                          onClick={() => {
                            setClearMatch(panelMatch);
                            setClearReason("");
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          size="sm"
          icon={UserRound}
          title="Find a registered player"
          description="Type a gamer tag to see that player's eight league fixtures. Only players registered in this tournament appear."
        />
      )}
    </div>
  );

  const gridTab = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <label
            htmlFor="results-matchday"
            className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            Matchday
          </label>
          <Select
            id="results-matchday"
            value={String(gridMatchday)}
            onChange={(event) => {
              setGridMatchday(Number.parseInt(event.target.value, 10));
              setGridScores({});
              setNotice(null);
            }}
          >
            {Array.from({ length: 8 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                Matchday {day}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-grey-500">
            {pendingGridCount} result{pendingGridCount === 1 ? "" : "s"} entered
          </p>
          <Button
            loading={busy === "bulk"}
            disabled={pendingGridCount === 0}
            leftIcon={<ListChecks aria-hidden="true" className="h-4 w-4" />}
            onClick={submitBulk}
          >
            Save entered results
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-white/10">
            {matchdayMatches.map((match) => {
              const entry = gridScores[match.id] ?? EMPTY_SCORE;
              const completed = match.status === "completed";

              return (
                <li
                  key={match.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-sm font-medium text-grey-100">{match.homeTag}</p>
                    </div>
                    {completed ? (
                      <span className="shrink-0 rounded bg-white/[0.06] px-2.5 py-1 font-display text-sm font-semibold tabular-nums text-white">
                        {match.homeGoals} – {match.awayGoals}
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <label className="sr-only" htmlFor={`grid-${match.id}-home`}>
                          {match.homeTag} score
                        </label>
                        <Input
                          id={`grid-${match.id}-home`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={entry.home}
                          onChange={(event) =>
                            setGridScores((current) => ({
                              ...current,
                              [match.id]: { ...entry, home: event.target.value },
                            }))
                          }
                          className="h-11 w-14 text-center font-display text-lg font-semibold tabular-nums"
                        />
                        <span className="text-grey-500">–</span>
                        <label className="sr-only" htmlFor={`grid-${match.id}-away`}>
                          {match.awayTag} score
                        </label>
                        <Input
                          id={`grid-${match.id}-away`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={entry.away}
                          onChange={(event) =>
                            setGridScores((current) => ({
                              ...current,
                              [match.id]: { ...entry, away: event.target.value },
                            }))
                          }
                          className="h-11 w-14 text-center font-display text-lg font-semibold tabular-nums"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-grey-100">{match.awayTag}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {completed ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCorrectMatch(match);
                            setCorrectScore(scorePair(match));
                            setCorrectReason("");
                          }}
                        >
                          Correct
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setClearMatch(match);
                            setClearReason("");
                          }}
                        >
                          Clear
                        </Button>
                      </>
                    ) : (
                      <Badge tone="neutral">Scheduled</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );

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

      <div className="rounded-xl border border-white/10 bg-navy-900/40 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
          <ClipboardList aria-hidden="true" className="h-4 w-4" />
          League results
        </p>
        <p className="mt-1.5 text-sm leading-6 text-grey-300">
          Record a final score after the match. A correction or clear needs a reason and is kept in
          the audit history. Players can only report a problem; they never submit or confirm
          results.
        </p>
      </div>

      <Tabs
        ariaLabel="Result entry methods"
        items={[
          { id: "player", label: "Find player", content: playerTab },
          { id: "grid", label: "Matchday grid", content: gridTab },
        ]}
      />

      <ConfirmDialog
        open={confirmEnter !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmEnter(null);
        }}
        title="Save this result?"
        description={
          confirmEnter ? (
            <span>
              <strong className="text-white">{scoreLabel(confirmEnter)}</strong>
              <br />
              This records the final score and cannot be changed without a reason.
            </span>
          ) : null
        }
        confirmLabel="Save result"
        tone="primary"
        loading={busy === "enter"}
        onConfirm={submitEnter}
      />

      <Dialog
        open={correctMatch !== null}
        onOpenChange={(open) => {
          if (!open) setCorrectMatch(null);
        }}
        title="Correct result"
        description={
          correctMatch
            ? `${correctMatch.homeTag} vs ${correctMatch.awayTag} · matchday ${correctMatch.matchday}`
            : null
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCorrectMatch(null)}>
              Cancel
            </Button>
            <Button loading={busy === "correct"} onClick={submitCorrect}>
              Save correction
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Input
              aria-label={`${correctMatch?.homeTag ?? "Home"} score`}
              inputMode="numeric"
              maxLength={2}
              value={correctScore.home}
              onChange={(event) =>
                setCorrectScore((current) => ({ ...current, home: event.target.value }))
              }
              className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
            />
            <span className="font-display text-2xl text-grey-500">–</span>
            <Input
              aria-label={`${correctMatch?.awayTag ?? "Away"} score`}
              inputMode="numeric"
              maxLength={2}
              value={correctScore.away}
              onChange={(event) =>
                setCorrectScore((current) => ({ ...current, away: event.target.value }))
              }
              className="h-14 w-20 text-center font-display text-2xl font-semibold tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="correct-reason"
              className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
            >
              Reason (5–300 characters)
            </label>
            <Textarea
              id="correct-reason"
              value={correctReason}
              maxLength={300}
              onChange={(event) => setCorrectReason(event.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={clearMatch !== null}
        onOpenChange={(open) => {
          if (!open) setClearMatch(null);
        }}
        title="Clear result"
        description={
          clearMatch
            ? `${clearMatch.homeTag} vs ${clearMatch.awayTag} · matchday ${clearMatch.matchday}`
            : null
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearMatch(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === "clear"} onClick={submitClear}>
              Clear result
            </Button>
          </>
        }
      >
        <div>
          <label
            htmlFor="clear-reason"
            className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            Reason (5–300 characters)
          </label>
          <Textarea
            id="clear-reason"
            value={clearReason}
            maxLength={300}
            onChange={(event) => setClearReason(event.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
}
