// GCC - public confirmed draw.
//
// Real Firestore data only: four pots of nine, the recorded method and the
// shuffle seed. Rendered only when `getPublicDraw` returns a confirmed draw.
import { ShieldCheck } from "lucide-react";

import { PotSummary, type PotsBoardPlayer } from "@/components/organiser/pots-board";
import { Card } from "@/components/ui/card";
import type { PublicDraw } from "@/lib/data/public-tournaments";
import { formatDateTime } from "@/lib/utils/dates";
import type { DrawMethod, PotNumber } from "@/types/domain";

const METHOD_LABELS: Readonly<Record<DrawMethod, string>> = {
  shuffle: "Seeded shuffle",
  manual: "Manual placement",
  mixed: "Seeded shuffle with pinned players",
};

export function PublicPotsPanel({
  draw,
  timezone,
}: {
  readonly draw: PublicDraw;
  readonly timezone: string;
}) {
  const pots = Object.fromEntries(
    draw.pots.map((entry) => [entry.pot, entry.players as readonly PotsBoardPlayer[]]),
  ) as Record<PotNumber, readonly PotsBoardPlayer[]>;

  return (
    <section className="border-b border-white/10">
      <div className="container space-y-6 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
            Confirmed draw
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">The pots</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-grey-400">
            Four pots of nine. Every registered player appears in exactly one pot. Pots carry no
            country or association restrictions.
          </p>
        </div>

        <PotSummary pots={pots} />

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-success-soft" />
            <p className="text-sm font-semibold text-white">How this draw was made</p>
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-grey-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-eyebrow text-grey-500">Method</dt>
              <dd>{METHOD_LABELS[draw.method]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-eyebrow text-grey-500">Confirmed</dt>
              <dd>
                {draw.confirmedAt
                  ? formatDateTime(draw.confirmedAt, { timeZone: timezone })
                  : "Recorded by the platform"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-eyebrow text-grey-500">Shuffle seed</dt>
              <dd>
                {draw.shuffleSeed ? (
                  <code className="break-all text-xs text-grey-300">{draw.shuffleSeed}</code>
                ) : (
                  "Not used — this draw was placed manually by the organiser."
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-grey-500">
            {draw.method === "manual"
              ? "A manual draw is recorded with the operator and every placement in the platform audit log."
              : "The seed and algorithm version are recorded, so the same allocation can be replayed and verified after the fact."}
          </p>
        </Card>
      </div>
    </section>
  );
}
