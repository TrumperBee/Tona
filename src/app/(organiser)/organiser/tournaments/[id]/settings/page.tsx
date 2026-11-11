// GCC - Tournament settings.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. This page renders the real editor: the editable-fields matrix decides
// which controls are enabled (the same matrix is enforced inside the PATCH
// transaction, so the two can never drift), and every locked field shows its
// honest reason.
import { notFound } from "next/navigation";

import { TournamentSettingsForm } from "@/components/tournament/tournament-settings-form";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getTournamentWorkspace } from "@/lib/organiser/workspace-access";
import {
  getEditableTournamentFields,
  TOURNAMENT_FIELD_IDS,
} from "@/lib/tournament/editable-fields";
import { utcIsoToZonedNaive } from "@/lib/utils/zoned-dates";

interface SettingsPageProps {
  readonly params: Promise<{ id: string }>;
}

export const metadata = { title: "Tournament settings" };

function naive(iso: string | null, timezone: string): string {
  if (!iso) {
    return "";
  }

  try {
    return utcIsoToZonedNaive(iso, timezone);
  } catch {
    return "";
  }
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;

  let tournament;

  try {
    tournament = (await getTournamentWorkspace(id)).tournament;
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const timezone = tournament.timezone;
  const editable = getEditableTournamentFields({
    status: tournament.status,
    registrationCount: tournament.registrationCount,
  });

  return (
    <div className="space-y-6">
      <TournamentSettingsForm
        tournamentId={id}
        name={tournament.name}
        status={tournament.status}
        editable={TOURNAMENT_FIELD_IDS.filter((field) => editable.has(field))}
        initial={{
          name: tournament.name,
          season: tournament.season,
          gameId: tournament.gameId,
          description: tournament.description,
          timezone,
          opensAt: naive(tournament.registrationOpensAt?.toDate().toISOString() ?? null, timezone),
          closesAt: naive(
            tournament.registrationClosesAt?.toDate().toISOString() ?? null,
            timezone,
          ),
          startsAt: naive(tournament.startsAt?.toDate().toISOString() ?? null, timezone),
          coverImageUrl: tournament.coverImageUrl,
          logoUrl: tournament.logoUrl,
          rules: tournament.rules,
          matchDurationMinutes: tournament.matchDurationMinutes,
          allowedPlatforms: tournament.allowedPlatforms,
          allowedCountries: tournament.allowedCountries,
        }}
      />

      <section className="rounded-xl border border-white/10 bg-navy-900/40 p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-display text-white">
          Fixed by the platform
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5">
            <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
              Format
            </dt>
            <dd className="mt-1 text-sm font-medium text-grey-100">
              36-team league phase (fixed for every GCC competition)
            </dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5">
            <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
              Field size
            </dt>
            <dd className="mt-1 text-sm font-medium text-grey-100">
              {tournament.maxParticipants} players
            </dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5">
            <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
              Public address
            </dt>
            <dd className="mt-1 break-all text-sm font-medium text-grey-100">
              /tournaments/{tournament.slug} (immutable)
            </dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5">
            <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
              Audit trail
            </dt>
            <dd className="mt-1 text-sm font-medium text-grey-100">
              Every saved change is recorded with its before and after values.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
