// GCC - public tournament discovery.
// Reads published tournaments from Firestore on the server. If Firestore is
// unreachable or empty, the page shows an honest empty state.
import { CalendarClock, ListChecks, Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { getPublicTournaments, type PublicTournamentSummary } from "@/lib/data/public-tournaments";

export const metadata = {
  title: "Tournaments",
  description: "Published GCC competitions with their real dates, status and registration counts.",
};

interface TournamentGroup {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof Trophy;
  readonly tournaments: readonly PublicTournamentSummary[];
}

const groupDefinitions = [
  {
    id: "open",
    eyebrow: "Open now",
    title: "Open for registration",
    description: "These competitions are accepting entries through the platform.",
    icon: ListChecks,
    statuses: ["registration_open"],
  },
  {
    id: "finalising",
    eyebrow: "Finalising",
    title: "Field being confirmed",
    description: "Entries are closed while the organiser confirms participants, pots and fixtures.",
    icon: CalendarClock,
    statuses: ["registration_closed", "pots_confirmed"],
  },
  {
    id: "live",
    eyebrow: "In progress",
    title: "Live competitions",
    description: "Fixtures are published and results are being recorded and verified.",
    icon: Swords,
    statuses: ["fixtures_published", "league_phase", "knockout"],
  },
  {
    id: "finished",
    eyebrow: "Recorded",
    title: "Completed and archived",
    description: "Finished seasons with their final standings and champion preserved.",
    icon: Trophy,
    statuses: ["completed", "archived"],
  },
] as const;

const lifecycle = [
  {
    title: "Entries open",
    description:
      "A published competition lists its real entry window and live registration count here.",
    icon: ListChecks,
  },
  {
    title: "Fixtures confirmed",
    description:
      "Once entries close, the organiser confirms participants, pots, fixtures and matchdays.",
    icon: Swords,
  },
  {
    title: "Permanent record",
    description:
      "Completed seasons keep their final standings and champion in the archive, not in a mock-up.",
    icon: Trophy,
  },
] as const;

export default async function TournamentsPage() {
  const tournaments = await getPublicTournaments(60);

  const groups: TournamentGroup[] = groupDefinitions
    .map((definition) => ({
      id: definition.id,
      eyebrow: definition.eyebrow,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      tournaments: tournaments.filter((tournament) =>
        (definition.statuses as readonly string[]).includes(tournament.status),
      ),
    }))
    .filter((group) => group.tournaments.length > 0);

  const openCount = tournaments.filter(
    (tournament) => tournament.status === "registration_open",
  ).length;
  const liveCount = tournaments.filter((tournament) =>
    ["fixtures_published", "league_phase", "knockout"].includes(tournament.status),
  ).length;

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Competitions"
            title="Tournaments"
            description="Every competition published on GCC, with its real status, start date and registration count. Nothing on this page is simulated."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Tournaments" }]}
          />

          {tournaments.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{tournaments.length} published</Badge>
              {openCount > 0 ? <Badge tone="info">{openCount} open for registration</Badge> : null}
              {liveCount > 0 ? <Badge tone="success">{liveCount} in progress</Badge> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="container py-12 sm:py-16">
          {tournaments.length === 0 ? (
            <div>
              <EmptyState
                size="lg"
                icon={ListChecks}
                eyebrow="No published competitions"
                title="No tournaments have been published yet"
                description={
                  <>
                    When an organiser publishes a competition, it appears here with its real dates,
                    format, status and registration count. There is no sample data on this page and
                    no count to inflate.
                  </>
                }
                action={
                  <Link href="/about" className={buttonStyles({ size: "sm" })}>
                    How GCC runs a season
                  </Link>
                }
                secondaryAction={
                  <Link
                    href="/rankings"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                  >
                    About rankings
                  </Link>
                }
              />

              <div className="mt-12 border-t border-white/10 pt-10">
                <h2 className="font-display text-2xl font-semibold uppercase tracking-display text-white">
                  What appears here
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-grey-400">
                  A tournament is listed only after an organiser publishes it. Every stage below is
                  tracked on the platform, so the list stays complete and accurate.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {lifecycle.map((stage) => {
                    const Icon = stage.icon;

                    return (
                      <Card key={stage.title} className="p-5">
                        <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <h3 className="mt-4 font-display text-lg font-semibold uppercase tracking-display text-white">
                          {stage.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-grey-400">{stage.description}</p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-14">
              {groups.map((group) => {
                const Icon = group.icon;

                return (
                  <section key={group.id} aria-labelledby={`${group.id}-heading`}>
                    <div className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                          {group.eyebrow}
                        </p>
                        <h2
                          id={`${group.id}-heading`}
                          className="mt-1 font-display text-2xl font-semibold uppercase tracking-display text-white sm:text-3xl"
                        >
                          {group.title}
                        </h2>
                        <p className="mt-1.5 text-sm text-grey-400">{group.description}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {group.tournaments.map((tournament) => (
                        <TournamentCard key={tournament.id} tournament={tournament} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {tournaments.length > 0 ? (
            <div className="mt-16 border-t border-white/10 pt-10">
              <SectionHeading
                eyebrow="Behind the list"
                title="Every entry is a real platform record"
                description="Tournament cards are generated from the tournament document: name, game, season, status, start date and registration count. Draft and suspended competitions are never listed."
                action={
                  <Link
                    href="/about"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                  >
                    About GCC
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
