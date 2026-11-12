// GCC - derived league table.
//
// Purely presentational. Every number arrives from a server-written standing
// document; this component never calculates a position, a point or a tie-break.
// The table scrolls on medium screens and becomes a card list on phones, so a
// 36-row table stays readable without a pinch-zoom.
import Link from "next/link";

import { Avatar } from "@/components/ui/data-display";
import {
  STANDING_BAND_LABELS,
  TIEBREAK_CRITERION_LABELS,
  type StandingBand,
  type StandingsForm,
  type TiebreakCriterion,
  type TiebreakerProfile,
} from "@/lib/engine/standings/types";
import { tiebreakCriteria } from "@/lib/engine/standings/tiebreakers";
import { cn } from "@/lib/utils/cn";

export interface StandingsTableRow {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly form: readonly StandingsForm[];
  readonly band: StandingBand;
  readonly separatedBy: TiebreakCriterion | null;
}

export interface StandingsTableProps {
  readonly rows: readonly StandingsTableRow[];
  readonly profile: TiebreakerProfile;
  readonly provisional: boolean;
  readonly updatedAt: string | null;
}

const BAND_ROW: Readonly<Record<StandingBand, string>> = {
  direct: "border-l-success bg-success/[0.07]",
  playoff_seeded: "border-l-electric-400 bg-electric-400/[0.07]",
  playoff_unseeded: "border-l-gold-400 bg-gold-400/[0.06]",
  eliminated: "border-l-grey-700 bg-white/[0.015]",
};

const BAND_DOT: Readonly<Record<StandingBand, string>> = {
  direct: "bg-success",
  playoff_seeded: "bg-electric-400",
  playoff_unseeded: "bg-gold-400",
  eliminated: "bg-grey-600",
};

const FORM_CHIP: Readonly<Record<StandingsForm, string>> = {
  W: "bg-success/15 text-success",
  D: "bg-white/10 text-grey-300",
  L: "bg-danger/15 text-danger",
};

const BAND_ORDER: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

function goalDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function FormChips({ form }: { readonly form: readonly StandingsForm[] }) {
  if (form.length === 0) {
    return <span className="text-xs text-grey-600">—</span>;
  }

  return (
    <span className="flex items-center gap-1" aria-label={`Recent form: ${form.join(", ")}`}>
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
            FORM_CHIP[result],
          )}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

function TieExplanation({ profile }: { readonly profile: TiebreakerProfile }) {
  const criteria = tiebreakCriteria(profile);

  return (
    <p className="text-xs leading-5 text-grey-500">
      <span className="font-semibold text-grey-400">Ties:</span>{" "}
      {criteria.map((criterion, index) => (
        <span key={criterion}>
          {index > 0 ? " → " : ""}
          <span className={criterion === "lot" ? "text-grey-300" : undefined}>
            {TIEBREAK_CRITERION_LABELS[criterion]}
          </span>
        </span>
      ))}
      . A drawing of lots is deterministic and is never replaced by manual ordering.
    </p>
  );
}

export function StandingsTable({ rows, profile, provisional, updatedAt }: StandingsTableProps) {
  return (
    <div className="space-y-4">
      {provisional ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
          Provisional table: results are still being recorded, so positions can change after every
          match. It becomes final once all 144 league matches are complete.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-grey-400">
        {BAND_ORDER.map((band) => (
          <span key={band} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-sm", BAND_DOT[band])} aria-hidden="true" />
            {STANDING_BAND_LABELS[band]}
          </span>
        ))}
        <span className="text-grey-600">
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
            : "Waiting for the first table rebuild"}
        </span>
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="sr-only">
            League table ordered by the published tie-break rules
          </caption>
          <thead>
            <tr className="border-b border-white/10 bg-navy-950/70 text-left text-[10px] uppercase tracking-eyebrow text-grey-500">
              <th scope="col" className="px-3 py-2.5 text-center">
                Pos
              </th>
              <th scope="col" className="px-3 py-2.5">
                Player
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Matches played">
                MP
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Won">
                W
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Drawn">
                D
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Lost">
                L
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Goals for">
                GF
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Goals against">
                GA
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Goal difference">
                GD
              </th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Points">
                Pts
              </th>
              <th scope="col" className="px-3 py-2.5">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.uid}
                className={cn(
                  "border-b border-l-2 border-white/[0.06] last:border-b-0",
                  BAND_ROW[row.band],
                )}
              >
                <td className="px-3 py-2.5 text-center font-display text-sm font-semibold tabular-nums text-white">
                  {row.position}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/players/${encodeURIComponent(row.gamerTag)}`}
                    className="flex min-w-0 items-center gap-2 rounded text-grey-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                  >
                    <Avatar name={row.gamerTag} src={row.avatarUrl} size="sm" />
                    <span className="truncate font-medium">{row.gamerTag}</span>
                  </Link>
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">{row.played}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">{row.won}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">{row.drawn}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">{row.lost}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">
                  {row.goalsFor}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">
                  {row.goalsAgainst}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-grey-300">
                  {goalDifference(row.goalDifference)}
                </td>
                <td className="px-2 py-2.5 text-center font-display text-base font-semibold tabular-nums text-white">
                  {row.points}
                </td>
                <td className="px-3 py-2.5">
                  <FormChips form={row.form} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.uid}
            className={cn("rounded-lg border border-l-2 border-white/10 p-3", BAND_ROW[row.band])}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 shrink-0 text-center font-display text-base font-semibold tabular-nums text-white">
                {row.position}
              </span>
              <Avatar name={row.gamerTag} src={row.avatarUrl} size="sm" />
              <Link
                href={`/players/${encodeURIComponent(row.gamerTag)}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-grey-100 hover:text-white"
              >
                {row.gamerTag}
              </Link>
              <span className="font-display text-lg font-semibold tabular-nums text-white">
                {row.points}
                <span className="ml-1 text-[10px] font-medium uppercase text-grey-500">pts</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-[11px] text-grey-400">
              <span>MP {row.played}</span>
              <span>W {row.won}</span>
              <span>D {row.drawn}</span>
              <span>L {row.lost}</span>
              <span>
                GF {row.goalsFor} · GA {row.goalsAgainst} · GD {goalDifference(row.goalDifference)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 pl-9">
              <span className="text-[11px] text-grey-500">{STANDING_BAND_LABELS[row.band]}</span>
              <FormChips form={row.form} />
            </div>
          </li>
        ))}
      </ul>

      <TieExplanation profile={profile} />
    </div>
  );
}
