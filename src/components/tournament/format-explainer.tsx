// GCC - visual explainer for the launch format.
// Every number and band comes from src/lib/config/formats.ts.
import { Check, Circle, Home, Plane, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { UCL_LEAGUE_PHASE_36 } from "@/lib/config/formats";
import { cn } from "@/lib/utils/cn";

const potStyles = [
  "border-electric-400/30 bg-electric-500/10",
  "border-electric-300/25 bg-electric-400/[0.08]",
  "border-white/15 bg-white/[0.05]",
  "border-gold-400/25 bg-gold-400/[0.06]",
] as const;

const bandStyles = [
  "border-success/30 bg-success/10",
  "border-electric-400/30 bg-electric-500/10",
  "border-warning/30 bg-warning/10",
  "border-danger/30 bg-danger/10",
] as const;

export function FormatExplainer() {
  const format = UCL_LEAGUE_PHASE_36;
  const slots = Array.from({ length: format.participants }, (_, index) => index);
  const pots = Array.from({ length: format.pots.count }, (_, index) => index + 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-navy-900/40">
      <div className="grid gap-px bg-white/10 md:grid-cols-4">
        {pots.map((pot) => (
          <div key={pot} className="bg-navy-950 p-5">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              Pot {pot}
            </p>
            <p className="mt-2 font-display text-4xl font-semibold text-white">
              {format.pots.size}
            </p>
            <p className="mt-1 text-xs text-grey-400">
              teams · {format.pots.opponentsPerPot} opponents drawn
            </p>
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-electric-300">
                The 36-team field
              </p>
              <p className="text-xs text-grey-400">Four pots · nine teams each</p>
            </div>

            <div aria-hidden="true" className="mt-4 grid grid-cols-9 gap-1.5 sm:gap-2">
              {slots.map((slot) => {
                const potIndex = Math.floor(slot / format.pots.size);

                return (
                  <span
                    key={slot}
                    className={cn(
                      "aspect-square rounded-[3px] border",
                      potStyles[potIndex] ?? potStyles[0],
                    )}
                  />
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-grey-400">
              {pots.map((pot) => (
                <span key={pot} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 rounded-sm border", potStyles[pot - 1])}
                  />
                  Pot {pot}
                </span>
              ))}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-navy-950/60 p-3">
                <dt className="text-[10px] uppercase tracking-eyebrow text-grey-400">Matches</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">
                  {format.matchesPerParticipant}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-navy-950/60 p-3">
                <dt className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow text-grey-400">
                  <Home aria-hidden="true" className="h-3 w-3" /> Home
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">
                  {format.homeMatches}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-navy-950/60 p-3">
                <dt className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow text-grey-400">
                  <Plane aria-hidden="true" className="h-3 w-3" /> Away
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">
                  {format.awayMatches}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-navy-950/60 p-3">
                <dt className="text-[10px] uppercase tracking-eyebrow text-grey-400">Matchdays</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white">
                  {format.matchdays}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
              Qualification
            </p>
            <ul className="mt-4 space-y-2.5">
              {format.qualification.map((band, index) => (
                <li
                  key={band.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    bandStyles[index] ?? bandStyles[0],
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-navy-950/50 font-display text-sm font-semibold text-white">
                    {Number(band.fromPosition) === Number(band.toPosition)
                      ? band.fromPosition
                      : `${band.fromPosition}–${band.toPosition}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{band.label}</p>
                    <p className="text-xs text-grey-400">
                      {band.destination === "eliminated"
                        ? "Season ends at the league phase"
                        : band.destination === "round-of-16"
                          ? "Direct to the knockout round"
                          : "Two-legged play-off"}
                    </p>
                  </div>
                  {band.destination === "eliminated" ? (
                    <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-danger-soft" />
                  ) : band.destination === "round-of-16" ? (
                    <Trophy aria-hidden="true" className="h-4 w-4 shrink-0 text-gold-300" />
                  ) : (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-electric-300" />
                  )}
                </li>
              ))}
            </ul>

            <Card variant="outline" className="mt-4 p-4">
              <p className="text-xs leading-5 text-grey-400">
                Pots are drawn without country restrictions. Every participant plays two different
                opponents from each pot, across {format.matchdays} matchdays, for{" "}
                {format.totalMatches} league-phase matches in total.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
