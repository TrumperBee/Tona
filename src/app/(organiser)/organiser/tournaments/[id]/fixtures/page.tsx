// GCC - organiser fixtures workspace.
//
// The server loads the confirmed draw, the private draft and any published
// matches behind the ownership guard. The client board only sends the explicit
// fixture actions; it never supplies a fixture, a seed or a result.
import { notFound } from "next/navigation";

import { FixturesBoard, type FixturesBoardDraft } from "@/components/organiser/fixtures-board";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getOrganiserFixtures } from "@/lib/tournament/fixtures";

export const metadata = { title: "Fixtures" };

interface FixturesPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function FixturesPage({ params }: FixturesPageProps) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getOrganiserFixtures>>;

  try {
    view = await getOrganiserFixtures(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const draft: FixturesBoardDraft | null = view.draft
    ? {
        seed: view.draft.seed,
        algorithmVersion: view.draft.algorithmVersion,
        scheduleHash: view.draft.scheduleHash,
        generatedAt: view.draft.generatedAt,
        generatedBy: view.draft.generatedBy,
        generationCount: view.draft.generationCount,
        report: view.draft.report,
        stats: view.draft.stats,
        fixtures: view.draft.fixtures,
        validation: view.draft.validation,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-navy-900/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
          League phase
        </p>
        <p className="mt-1.5 text-sm leading-6 text-grey-300">
          Thirty-six players, four pots of nine, eight matchdays of eighteen. Every player faces two
          opponents from each pot — one at home and one away — and never the same player twice. The
          server generates the seed; the client never chooses a fixture.
        </p>
      </div>

      <FixturesBoard
        tournamentId={id}
        status={view.tournament.status}
        startsAt={view.tournament.startsAt?.toDate().toISOString() ?? null}
        timezone={view.tournament.timezone}
        draft={draft}
        matchdays={view.matchdays}
        matches={view.matches}
        hasResults={view.hasResults}
        scheduleHash={view.scheduleHash}
        fixturesPublishedAt={view.fixturesPublishedAt}
        players={view.players}
      />
    </div>
  );
}
