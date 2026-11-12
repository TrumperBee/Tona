"use client";

// GCC - organiser fixtures board.
//
// The server has already loaded the authoritative draft/published schedule and
// every mutation returns to it for a refresh. This component only offers the
// five explicit actions: generate, publish, edit a matchday window, verify the
// integrity of the published list, and reset while no result exists. It never
// invents a fixture, a seed or a result.
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileWarning,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/data-display";
import { countryFlag, countryName } from "@/lib/config/countries";
import { formatDate } from "@/lib/utils/dates";
import type { TournamentStatus } from "@/types/domain";

const MATCHDAY_COUNT = 8;
const MATCHES_PER_MATCHDAY = 18;
const MATCH_COUNT = MATCHDAY_COUNT * MATCHES_PER_MATCHDAY;
const PLAYER_COUNT = 36;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FixturesBoardPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
  readonly pot: number;
}

export interface FixturesBoardFixture {
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
}

export interface FixturesBoardWindow {
  readonly number: number;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface FixturesBoardReport {
  readonly algorithmVersion: number;
  readonly attemptSeed: string;
  readonly attempts: number;
  readonly colouringNodes: number;
  readonly maxHomeAwayStreak: number;
  readonly playersWithStreak3Plus: number;
  readonly perMatchdayCounts: readonly number[];
}

export interface FixturesBoardPlayerStats {
  readonly playerId: string;
  readonly pot: number;
  readonly home: number;
  readonly away: number;
  readonly opponentsByPot: readonly number[];
}

export interface FixturesBoardStats {
  readonly matchCount: number;
  readonly perMatchdayCounts: readonly number[];
  readonly perPlayer: readonly FixturesBoardPlayerStats[];
}

export interface FixturesBoardDraft {
  readonly seed: string;
  readonly algorithmVersion: number;
  readonly scheduleHash: string;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly generationCount: number;
  readonly report: FixturesBoardReport;
  readonly stats: FixturesBoardStats;
  readonly fixtures: readonly FixturesBoardFixture[];
  readonly validation: {
    readonly valid: boolean;
    readonly issues: readonly { readonly code: string; readonly message: string }[];
  };
}

export interface FixturesBoardProps {
  readonly tournamentId: string;
  readonly status: TournamentStatus;
  readonly startsAt: string | null;
  readonly timezone: string;
  readonly draft: FixturesBoardDraft | null;
  readonly matchdays: readonly FixturesBoardWindow[];
  readonly matches: readonly FixturesBoardFixture[];
  readonly hasResults: boolean;
  readonly scheduleHash: string | null;
  readonly fixturesPublishedAt: string | null;
  readonly players: readonly FixturesBoardPlayer[];
}

interface VerifyResult {
  readonly valid: boolean;
  readonly matchCount: number;
  readonly matchdayCount: number;
  readonly hash: string | null;
  readonly storedHash: string | null;
  readonly issues: readonly { readonly code: string; readonly message: string }[];
}

interface ApiBody {
  readonly error?: string;
  readonly fields?: Record<string, string>;
  readonly [key: string]: unknown;
}

interface WindowDraft {
  number: number;
  startsOn: string;
  endsOn: string;
}

function toInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

function inputToIso(value: string): string {
  // The clock is read as UTC so what the organiser types is exactly what the
  // server stores; every display converts back to the tournament time zone.
  return new Date(`${value}:00.000Z`).toISOString();
}

function defaultWindows(startsAt: string | null): WindowDraft[] {
  const base = startsAt ? new Date(startsAt) : new Date();

  return Array.from({ length: MATCHDAY_COUNT }, (_, index) => {
    const start = new Date(base.getTime() + index * 7 * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);

    return {
      number: index + 1,
      startsOn: toInputValue(start.toISOString()),
      endsOn: toInputValue(end.toISOString()),
    };
  });
}

function initialWindows(props: FixturesBoardProps): WindowDraft[] {
  if (props.matchdays.length === MATCHDAY_COUNT) {
    return props.matchdays.map((window) => ({
      number: window.number,
      startsOn: toInputValue(window.startsOn),
      endsOn: toInputValue(window.endsOn),
    }));
  }

  return defaultWindows(props.startsAt);
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);

  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(fileName: string, rows: readonly FixturesBoardFixture[]): void {
  const header = [
    "matchday",
    "match_id",
    "home_uid",
    "home_tag",
    "away_uid",
    "away_tag",
    "scheduled_at",
    "status",
    "home_goals",
    "away_goals",
  ];
  const lines = rows.map((row) =>
    [
      row.matchday,
      row.id,
      row.homeUid,
      row.homeTag,
      row.awayUid,
      row.awayTag,
      row.scheduledAt,
      row.status,
      row.homeGoals,
      row.awayGoals,
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function sendJson(
  path: string,
  method: "POST" | "PATCH" | "GET",
  body?: unknown,
): Promise<{ ok: boolean; data: ApiBody }> {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
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

function errorMessage(data: ApiBody): string {
  return (
    (data.fields && Object.values(data.fields)[0]) ??
    (typeof data.error === "string" ? data.error : "That action did not complete. Try again.")
  );
}

export function FixturesBoard(props: FixturesBoardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [matchday, setMatchday] = useState(1);
  const [playerUid, setPlayerUid] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [editWindow, setEditWindow] = useState<WindowDraft | null>(null);
  const [windowRows, setWindowRows] = useState<WindowDraft[]>(() => initialWindows(props));

  const published = props.status !== "pots_confirmed" && props.matches.length > 0;
  const rows = useMemo(
    () => (published ? props.matches : (props.draft?.fixtures ?? [])),
    [published, props.matches, props.draft],
  );
  const canGenerate = props.status === "pots_confirmed" && !published;
  const setupReady = props.status === "pots_confirmed" || published;

  const player = props.players.find((entry) => entry.uid === playerUid) ?? null;
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.matchday === matchday &&
          (playerUid.length === 0 || row.homeUid === playerUid || row.awayUid === playerUid),
      ),
    [rows, matchday, playerUid],
  );
  const playerStrip = useMemo(() => {
    if (!playerUid) {
      return [];
    }

    return Array.from({ length: MATCHDAY_COUNT }, (_, index) => {
      const day = index + 1;
      const fixture = rows.find(
        (row) => row.matchday === day && (row.homeUid === playerUid || row.awayUid === playerUid),
      );

      if (!fixture) {
        return { day, fixture: null, home: false, opponent: "—" };
      }

      const home = fixture.homeUid === playerUid;
      const opponent = home
        ? props.players.find((entry) => entry.uid === fixture.awayUid)
        : props.players.find((entry) => entry.uid === fixture.homeUid);

      return {
        day,
        fixture,
        home,
        opponent: opponent?.gamerTag ?? (home ? fixture.awayTag : fixture.homeTag),
      };
    });
  }, [playerUid, rows, props.players]);

  const checklist = useMemo(() => {
    const stats = props.draft?.stats;
    const perMatchday = props.draft?.report.perMatchdayCounts ?? [];
    const playersOk =
      stats?.perPlayer.length === PLAYER_COUNT &&
      stats.perPlayer.every(
        (entry) =>
          entry.home === 4 &&
          entry.away === 4 &&
          entry.opponentsByPot.length === 4 &&
          entry.opponentsByPot.every((count) => count === 2),
      );

    return [
      { label: `Exactly ${MATCH_COUNT} fixtures`, ok: rows.length === MATCH_COUNT },
      {
        label: `${MATCHES_PER_MATCHDAY} fixtures on every matchday`,
        ok:
          perMatchday.length === MATCHDAY_COUNT &&
          perMatchday.every((count) => count === MATCHES_PER_MATCHDAY),
      },
      {
        label: "Eight matchdays",
        ok: new Set(rows.map((row) => row.matchday)).size === MATCHDAY_COUNT,
      },
      { label: `Every player has four home and four away matches`, ok: playersOk },
      { label: "Two opponents from every pot, one home and one away", ok: playersOk },
      { label: "No repeated pairing", ok: props.draft?.validation.valid === true },
    ];
  }, [props.draft, rows]);

  function openPublish(): void {
    setWindowRows(initialWindows(props));
    setError(null);
    setPublishOpen(true);
  }

  async function generate(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy("generate");
    setError(null);
    setNotice(null);
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/fixtures/generate`,
      "POST",
      {},
    );

    if (!result.ok) {
      setError(errorMessage(result.data));
      setBusy(null);
      return;
    }

    setNotice(
      "A new schedule was generated and validated. The draft is private until you publish it.",
    );
    setBusy(null);
    router.refresh();
  }

  async function publish(): Promise<void> {
    if (busy) {
      return;
    }

    const invalid = windowRows.find((row) => inputToIso(row.endsOn) < inputToIso(row.startsOn));

    if (invalid) {
      setError(`Matchday ${invalid.number} ends before it starts.`);
      return;
    }

    setBusy("publish");
    setError(null);
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/fixtures/publish`,
      "POST",
      {
        windows: windowRows.map((row) => ({
          number: row.number,
          startsOn: inputToIso(row.startsOn),
          endsOn: inputToIso(row.endsOn),
        })),
      },
    );

    if (!result.ok) {
      setError(errorMessage(result.data));
      setBusy(null);
      return;
    }

    setPublishOpen(false);
    setNotice("The schedule is published. Every player can now see their eight matches.");
    setBusy(null);
    router.refresh();
  }

  async function reset(reason: string): Promise<void> {
    if (busy) {
      return;
    }

    setBusy("reset");
    setError(null);
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/fixtures/reset`,
      "POST",
      reason.trim().length > 0 ? { reason: reason.trim() } : {},
    );

    if (!result.ok) {
      setError(errorMessage(result.data));
      setBusy(null);
      return;
    }

    setResetOpen(false);
    setNotice(
      "The published fixtures were removed and the competition returned to pots confirmed.",
    );
    setBusy(null);
    router.refresh();
  }

  async function verifyIntegrity(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy("verify");
    setError(null);
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/fixtures/verify`,
      "GET",
    );

    if (!result.ok) {
      setError(errorMessage(result.data));
      setBusy(null);
      return;
    }

    setVerify({
      valid: result.data.valid === true,
      matchCount: typeof result.data.matchCount === "number" ? result.data.matchCount : 0,
      matchdayCount: typeof result.data.matchdayCount === "number" ? result.data.matchdayCount : 0,
      hash: typeof result.data.hash === "string" ? result.data.hash : null,
      storedHash: typeof result.data.storedHash === "string" ? result.data.storedHash : null,
      issues: Array.isArray(result.data.issues)
        ? (result.data.issues as { code: string; message: string }[])
        : [],
    });
    setVerifyOpen(true);
    setBusy(null);
  }

  async function saveWindow(): Promise<void> {
    if (!editWindow || busy) {
      return;
    }

    if (inputToIso(editWindow.endsOn) < inputToIso(editWindow.startsOn)) {
      setError(`Matchday ${editWindow.number} ends before it starts.`);
      return;
    }

    setBusy("window");
    setError(null);
    const result = await sendJson(
      `/api/organiser/tournaments/${props.tournamentId}/fixtures/matchdays/${editWindow.number}`,
      "PATCH",
      {
        startsOn: inputToIso(editWindow.startsOn),
        endsOn: inputToIso(editWindow.endsOn),
      },
    );

    if (!result.ok) {
      setError(errorMessage(result.data));
      setBusy(null);
      return;
    }

    setEditWindow(null);
    setNotice(`Matchday ${editWindow.number} window updated.`);
    setBusy(null);
    router.refresh();
  }

  if (!setupReady) {
    return (
      <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.04] p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-display text-gold-200">
          Fixtures are not available yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-grey-300">
          The schedule is generated from the confirmed pots. Confirm the draw first; the fixtures
          tab unlocks immediately after that.
        </p>
        <p className="mt-2 text-xs leading-5 text-grey-400">
          Publishing moves the competition to the league phase. It is a recorded status change,
          never a silent edit.
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
      {notice ? (
        <p className="rounded-lg border border-success/30 bg-success/[0.06] p-3 text-sm text-success-soft">
          {notice}
        </p>
      ) : null}

      {published ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/[0.06] p-4">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-success-soft" />
          <p className="text-sm font-semibold text-success-soft">Fixtures are published</p>
          {props.fixturesPublishedAt ? (
            <p className="text-xs text-grey-400">
              Published {formatDate(props.fixturesPublishedAt, { timeZone: props.timezone })}
            </p>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
              onClick={() => void verifyIntegrity()}
              loading={busy === "verify"}
              loadingLabel="Verifying"
              disabled={Boolean(busy)}
            >
              Verify integrity
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
              onClick={() => downloadCsv(`fixtures-${props.tournamentId}.csv`, rows)}
              disabled={rows.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setResetOpen(true)}
              disabled={Boolean(busy) || props.hasResults}
              title={
                props.hasResults
                  ? "A result already exists, so the schedule can no longer be reset."
                  : undefined
              }
            >
              Reset fixtures
            </Button>
          </div>
        </div>
      ) : null}

      {props.hasResults ? (
        <p className="rounded-lg border border-gold-400/25 bg-gold-400/[0.04] p-3 text-xs leading-5 text-gold-200">
          At least one result has been recorded, so the fixture list is now permanent.
        </p>
      ) : null}

      <Card variant="elevated">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-electric-300" />
                {published ? "Published schedule" : "Fixture generator"}
              </CardTitle>
              <p className="mt-1.5 text-sm leading-6 text-grey-400">
                {published
                  ? "The schedule is read-only. Matchday windows stay editable; results are recorded elsewhere."
                  : "A server-generated seed builds 144 fixtures. The independent validator checks every rule before the draft is stored."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!published ? (
                <Button
                  leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => void generate()}
                  loading={busy === "generate"}
                  loadingLabel="Generating"
                  disabled={Boolean(busy) || !canGenerate}
                >
                  {props.draft ? "Regenerate" : "Generate fixtures"}
                </Button>
              ) : null}
              {!published ? (
                <Button
                  variant="gold"
                  leftIcon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                  onClick={openPublish}
                  disabled={Boolean(busy) || !props.draft}
                >
                  Publish fixtures
                </Button>
              ) : null}
              {!published ? (
                <Button
                  variant="secondary"
                  leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => downloadCsv(`fixtures-${props.tournamentId}.csv`, rows)}
                  disabled={rows.length === 0}
                >
                  Export CSV
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {props.draft ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact label="Seed" value={props.draft.seed} mono />
                  <Fact label="Attempts" value={String(props.draft.report.attempts)} />
                  <Fact label="Algorithm" value={`v${props.draft.algorithmVersion}`} />
                  <Fact
                    label="Generated"
                    value={formatDate(props.draft.generatedAt, { timeZone: props.timezone })}
                  />
                </dl>

                <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                    Validation checklist
                  </p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {checklist.map((item) => (
                      <li key={item.label} className="flex items-start gap-2 text-xs text-grey-300">
                        {item.ok ? (
                          <Check
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-soft"
                          />
                        ) : (
                          <X
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-soft"
                          />
                        )}
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {props.draft.report.playersWithStreak3Plus > 0 ? (
                  <p className="flex items-start gap-2 rounded-lg border border-gold-400/25 bg-gold-400/[0.04] p-3 text-xs leading-5 text-gold-200">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    {props.draft.report.playersWithStreak3Plus} player
                    {props.draft.report.playersWithStreak3Plus === 1 ? " has" : "s have"} a run of
                    three or more consecutive home or away matches. The schedule is valid;
                    best-effort streak reduction stopped here.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-success-soft">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    No player has a three-match home or away run.
                  </p>
                )}

                <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                    Schedule hash
                  </p>
                  <code className="mt-1 block break-all text-xs text-grey-300">
                    {props.draft.scheduleHash}
                  </code>
                  <p className="mt-1 text-[11px] leading-5 text-grey-500">
                    Canonical SHA-256 over the 144 fixtures. Publication stores it so the published
                    matches can be re-verified at any time.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Fact label="Matches" value={String(props.draft.stats.matchCount)} />
                  <Fact label="Players" value={String(props.draft.stats.perPlayer.length)} />
                  <Fact label="Home per player" value="4" />
                  <Fact label="Away per player" value="4" />
                </div>
                <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                    Fixtures per matchday
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-grey-300">
                    {props.draft.report.perMatchdayCounts.map((count, index) => (
                      <li key={index} className="flex items-center justify-between gap-3">
                        <span>Matchday {index + 1}</span>
                        <span className="font-semibold tabular-nums text-grey-100">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[11px] leading-5 text-grey-500">
                  This draft is private. It appears on the public tournament page only after you
                  publish it.
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/15 bg-navy-950/40 p-4 text-sm leading-6 text-grey-400">
              No draft exists yet. Generate the schedule from the confirmed pots; nothing is created
              from a client-supplied list.
            </p>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Match list</CardTitle>
                <p className="mt-1 text-xs text-grey-500">
                  {published
                    ? "Published fixtures, grouped by matchday."
                    : "Draft fixtures. Regenerating replaces every row."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="player-filter" className="text-xs text-grey-400">
                  Filter by player
                </label>
                <Select
                  id="player-filter"
                  value={playerUid}
                  onChange={(event) => setPlayerUid(event.target.value)}
                  className="h-9 w-48 text-xs"
                >
                  <option value="">All players</option>
                  {props.players.map((entry) => (
                    <option key={entry.uid} value={entry.uid}>
                      @{entry.gamerTag} · Pot {entry.pot}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {player ? (
              <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={player.gamerTag} src={player.avatarUrl} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-grey-100">@{player.gamerTag}</p>
                    <p className="text-[11px] text-grey-500">
                      Pot {player.pot}
                      {player.country ? (
                        <>
                          {" · "}
                          <span aria-hidden="true">{countryFlag(player.country)}</span>{" "}
                          {countryName(player.country) ?? player.country}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {playerStrip.map((cell) => (
                    <div
                      key={cell.day}
                      className={`rounded-md border p-2 text-center ${
                        cell.fixture && cell.home
                          ? "border-electric-400/35 bg-electric-500/[0.08]"
                          : "border-white/10 bg-navy-900/60"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                        MD {cell.day}
                      </p>
                      <p
                        className={`mt-0.5 font-display text-sm font-semibold ${
                          cell.home ? "text-electric-200" : "text-grey-200"
                        }`}
                      >
                        {cell.fixture ? (cell.home ? "H" : "A") : "—"}
                      </p>
                      <p className="truncate text-[10px] text-grey-400">{cell.opponent}</p>
                      {cell.fixture?.status === "completed" ? (
                        <p className="text-[10px] font-semibold text-grey-200">
                          {cell.fixture.homeGoals}–{cell.fixture.awayGoals}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              role="tablist"
              aria-label="Matchdays"
              className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10 pb-1"
            >
              {Array.from({ length: MATCHDAY_COUNT }, (_, index) => index + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={matchday === day}
                  onClick={() => setMatchday(day)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    matchday === day
                      ? "bg-electric-500/15 text-electric-200"
                      : "text-grey-400 hover:bg-white/[0.04] hover:text-grey-200"
                  }`}
                >
                  MD {day}
                </button>
              ))}
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleRows.length === 0 ? (
                <li className="text-sm text-grey-400">
                  No fixture matches that filter on matchday {matchday}.
                </li>
              ) : (
                visibleRows.map((row) => (
                  <MatchRow
                    key={row.id}
                    row={row}
                    players={props.players}
                    highlightUid={playerUid || null}
                  />
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {published && props.matchdays.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Matchday windows</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {props.matchdays.map((window) => (
                <li
                  key={window.number}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-navy-950/50 p-3"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                      Matchday {window.number}
                    </p>
                    <p className="mt-1 text-xs text-grey-300">
                      {formatDate(window.startsOn, { timeZone: props.timezone })} –{" "}
                      {formatDate(window.endsOn, { timeZone: props.timezone })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
                    onClick={() =>
                      setEditWindow({
                        number: window.number,
                        startsOn: toInputValue(window.startsOn),
                        endsOn: toInputValue(window.endsOn),
                      })
                    }
                    disabled={Boolean(busy)}
                  >
                    Edit window
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-5 text-grey-500">
              Windows are informational. Editing them never changes a fixture or a result.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PublishDialog
        open={publishOpen}
        busy={busy === "publish"}
        windows={windowRows}
        startsAt={props.startsAt}
        onOpenChange={(open) => !busy && setPublishOpen(open)}
        onChange={setWindowRows}
        onReset={() => setWindowRows(defaultWindows(props.startsAt))}
        onConfirm={() => void publish()}
      />

      <ResetDialog
        open={resetOpen}
        busy={busy === "reset"}
        onOpenChange={(open) => !busy && setResetOpen(open)}
        onConfirm={(reason) => void reset(reason)}
      />

      <Dialog
        open={editWindow !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditWindow(null);
          }
        }}
        title={editWindow ? `Matchday ${editWindow.number} window` : "Matchday window"}
        description="Times are stored in UTC and shown to players in the competition time zone."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditWindow(null)}
              disabled={Boolean(busy)}
            >
              Cancel
            </Button>
            <Button
              loading={busy === "window"}
              loadingLabel="Saving"
              onClick={() => void saveWindow()}
            >
              Save window
            </Button>
          </>
        }
      >
        {editWindow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-grey-400">
              Starts
              <Input
                type="datetime-local"
                value={editWindow.startsOn}
                onChange={(event) => setEditWindow({ ...editWindow, startsOn: event.target.value })}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-grey-400">
              Ends
              <Input
                type="datetime-local"
                value={editWindow.endsOn}
                onChange={(event) => setEditWindow({ ...editWindow, endsOn: event.target.value })}
                className="mt-1"
              />
            </label>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={verifyOpen}
        onOpenChange={(open) => !busy && setVerifyOpen(open)}
        title={verify?.valid ? "Integrity verified" : "Integrity check failed"}
        description="The stored matches were rebuilt and re-checked against the independent validator and the published schedule hash."
        footer={
          <Button variant="secondary" onClick={() => setVerifyOpen(false)}>
            Close
          </Button>
        }
      >
        {verify ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={verify.valid ? "success" : "danger"}>
                {verify.valid ? "Valid" : "Issues found"}
              </Badge>
              <span className="text-xs text-grey-400">
                {verify.matchCount} matches · {verify.matchdayCount} matchdays
              </span>
            </div>
            {verify.issues.length > 0 ? (
              <ul className="space-y-1.5">
                {verify.issues.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.message}`}
                    className="flex items-start gap-2 text-xs text-danger-soft"
                  >
                    <FileWarning aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xs text-success-soft">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Every rule passed and the canonical hash matches the published record.
              </p>
            )}
            <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                Recomputed hash
              </p>
              <code className="mt-1 block break-all text-[11px] text-grey-300">
                {verify.hash ?? "—"}
              </code>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                Published hash
              </p>
              <code className="mt-1 block break-all text-[11px] text-grey-300">
                {verify.storedHash ?? "—"}
              </code>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-navy-950/50 p-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
        {label}
      </dt>
      <dd className={`mt-1 break-all text-xs font-medium text-grey-100 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function MatchRow({
  row,
  players,
  highlightUid,
}: {
  readonly row: FixturesBoardFixture;
  readonly players: readonly FixturesBoardPlayer[];
  readonly highlightUid: string | null;
}) {
  const home = players.find((entry) => entry.uid === row.homeUid);
  const away = players.find((entry) => entry.uid === row.awayUid);
  const highlighted =
    highlightUid !== null && (row.homeUid === highlightUid || row.awayUid === highlightUid);

  return (
    <li
      className={`rounded-lg border p-2.5 ${
        highlighted
          ? "border-electric-400/35 bg-electric-500/[0.06]"
          : "border-white/10 bg-navy-950/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-grey-100">
          <span aria-hidden="true">{home?.country ? countryFlag(home.country) : ""}</span>{" "}
          {row.homeTag}
        </p>
        <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-grey-200">
          {row.status === "completed" && row.homeGoals !== null && row.awayGoals !== null
            ? `${row.homeGoals}–${row.awayGoals}`
            : "vs"}
        </span>
        <p className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-grey-100">
          {row.awayTag}{" "}
          <span aria-hidden="true">{away?.country ? countryFlag(away.country) : ""}</span>
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-grey-500">
        <span>{row.id}</span>
        <span className="flex items-center gap-1">
          <CalendarDays aria-hidden="true" className="h-3 w-3" />
          {row.scheduledAt ? formatDate(row.scheduledAt) : "Window to be set"}
        </span>
      </div>
    </li>
  );
}

function PublishDialog({
  open,
  busy,
  windows,
  startsAt,
  onOpenChange,
  onChange,
  onReset,
  onConfirm,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly windows: readonly WindowDraft[];
  readonly startsAt: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (windows: WindowDraft[]) => void;
  readonly onReset: () => void;
  readonly onConfirm: () => void;
}) {
  function update(number: number, patch: Partial<WindowDraft>): void {
    onChange(
      windows.map((window) => (window.number === number ? { ...window, ...patch } : window)),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish the fixtures?"
      description="Eight informational matchday windows. Publishing writes 144 matches, eight matchdays and 36 zeroed standings, then moves the competition to fixtures published."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={busy}
            loadingLabel="Publishing"
            onClick={onConfirm}
            disabled={busy}
          >
            Publish fixtures
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-5 text-grey-400">
            Defaults start on the competition date, one week apart with six-day windows.
            {startsAt ? ` Competition start: ${formatDate(startsAt)} UTC.` : ""}
          </p>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={busy}>
            Restore defaults
          </Button>
        </div>
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {windows.map((window) => (
            <li
              key={window.number}
              className="grid gap-2 rounded-lg border border-white/10 bg-navy-950/50 p-2.5 sm:grid-cols-[auto_1fr_1fr] sm:items-center"
            >
              <span className="text-xs font-semibold text-grey-300">MD {window.number}</span>
              <label className="text-[10px] text-grey-500">
                Starts (UTC)
                <Input
                  type="datetime-local"
                  value={window.startsOn}
                  onChange={(event) => update(window.number, { startsOn: event.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </label>
              <label className="text-[10px] text-grey-500">
                Ends (UTC)
                <Input
                  type="datetime-local"
                  value={window.endsOn}
                  onChange={(event) => update(window.number, { endsOn: event.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </label>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-[11px] leading-5 text-grey-500">
          <Eye aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Publishing is one transaction. Thirty-six players are notified in small batches, and every
          window stays editable afterwards.
        </p>
      </div>
    </Dialog>
  );
}

function ResetDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset the published fixtures?"
      description="Every match, matchday window and zeroed standing is deleted. The competition returns to pots confirmed and the private draft is kept."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            loadingLabel="Resetting"
            onClick={() => onConfirm(reason)}
            disabled={busy}
          >
            Reset fixtures
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label htmlFor="reset-reason" className="block text-sm font-medium text-grey-200">
          Reason (optional, recorded in the audit log)
        </label>
        <Textarea
          id="reset-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="For example: the competition dates changed before the first match."
        />
        <p className="text-xs leading-5 text-grey-500">
          Reset is refused once any result exists. That is why the button is disabled on published
          schedules with recorded scores.
        </p>
      </div>
    </Dialog>
  );
}
