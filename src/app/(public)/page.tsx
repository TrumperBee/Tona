// GCC - public home page.
// Static product copy plus a real Firestore read for published tournaments.
import {
  ArrowRight,
  CircleDot,
  ListChecks,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { EHubMarketPromo } from "@/components/marketplace/ehubmarket-promo";
import { SectionHeading } from "@/components/shared/page-header";
import { FormatExplainer } from "@/components/tournament/format-explainer";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { UCL_LEAGUE_PHASE_36 } from "@/lib/config/formats";
import { getPublicTournaments } from "@/lib/data/public-tournaments";

const steps = [
  {
    number: "01",
    title: "Build your profile",
    description:
      "Register your gamer tag, country, game and platform. Your profile becomes your competition identity.",
    icon: UserPlus,
  },
  {
    number: "02",
    title: "Enter the draw",
    description:
      "Accepted players are placed into four pots of nine. Pots are drawn without country restrictions.",
    icon: CircleDot,
  },
  {
    number: "03",
    title: "Play eight matches",
    description:
      "Every participant plays two different opponents from each pot: four at home, four away, across eight matchdays.",
    icon: Swords,
  },
  {
    number: "04",
    title: "Qualify",
    description:
      "Positions 1-8 reach the Round of 16 directly. Positions 9-24 enter two-legged play-offs. Positions 25-36 are eliminated.",
    icon: Trophy,
  },
] as const;

export default async function HomePage() {
  const tournaments = await getPublicTournaments(3);
  const format = UCL_LEAGUE_PHASE_36;

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 bg-hero-glow" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-pitch-grid bg-grid opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />

        <div className="container relative grid gap-12 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-24">
          <div>
            <Badge tone="info" className="gap-2">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Independent. Built for football gaming communities.
            </Badge>
            <h1 className="text-shadow-hero mt-6 font-display text-5xl font-semibold uppercase leading-[0.92] tracking-display text-white sm:text-6xl lg:text-7xl">
              One Platform.
              <br />
              <span className="text-electric-300">Endless Competition.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-grey-300 sm:text-lg">
              GCC runs leagues, draws, fixtures, verified results and permanent records for football
              gaming communities. One home for every season, every table and every champion.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/tournaments" className={buttonStyles({ size: "lg" })}>
                Explore tournaments
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className={buttonStyles({ variant: "secondary", size: "lg" })}
              >
                How it works
              </Link>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Teams", value: format.participants },
                { label: "Pots", value: format.pots.count },
                { label: "Matchdays", value: format.matchdays },
                { label: "League matches", value: format.totalMatches },
              ].map((fact) => (
                <div key={fact.label} className="border-l border-white/10 pl-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                    {fact.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-white">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-grey-500">Launch format: 36-team league phase.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden="true"
              className="absolute inset-8 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.16),transparent_70%)]"
            />
            <Card
              variant="elevated"
              className="relative overflow-hidden border-white/15 bg-navy-900/80 p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                  The circuit
                </p>
                <Badge tone="gold">{format.participants} teams</Badge>
              </div>

              <div className="relative mt-6 grid place-items-center py-8">
                <div
                  aria-hidden="true"
                  className="absolute h-60 w-60 rounded-full border border-electric-400/20"
                />
                <div
                  aria-hidden="true"
                  className="absolute h-44 w-44 rounded-full border border-electric-400/20"
                />
                <div
                  aria-hidden="true"
                  className="absolute h-28 w-28 rounded-full border border-electric-400/15"
                />
                <div className="relative text-center">
                  <p className="font-display text-7xl font-semibold leading-none text-white">
                    {format.participants}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-eyebrow text-electric-300">
                    team field
                  </p>
                </div>

                {format.qualification.map((band, index) => {
                  const positions = [
                    "left-0 top-2",
                    "right-0 top-1/3",
                    "bottom-2 right-4",
                    "bottom-4 left-2",
                  ] as const;

                  return (
                    <span
                      key={band.id}
                      className={`absolute ${positions[index]} flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-950/80 px-2 py-1 text-[10px] font-semibold text-grey-300`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          index === 0
                            ? "bg-success"
                            : index === 1
                              ? "bg-electric-400"
                              : index === 2
                                ? "bg-warning"
                                : "bg-danger"
                        }`}
                      />
                      {band.fromPosition}-{band.toPosition}
                    </span>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
                {[
                  { label: "Pots", value: format.pots.count },
                  { label: "Matches each", value: format.matchesPerParticipant },
                  { label: "Home / away", value: `${format.homeMatches} / ${format.awayMatches}` },
                ].map((item) => (
                  <div key={item.label} className="bg-navy-950/90 p-3 text-center">
                    <p className="font-display text-xl font-semibold text-white">{item.value}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-eyebrow text-grey-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-b border-white/10">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="From sign-up to the knockout stage"
            description="A clear competitive path for players and organisers. No hidden brackets and no manual spreadsheet work."
          />

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <li key={step.number}>
                  <Card className="h-full p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-sm font-semibold text-gold-300">
                        {step.number}
                      </span>
                      <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold uppercase tracking-display text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-grey-400">{step.description}</p>
                  </Card>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="The format"
            title="The 36-team league phase, explained"
            description="Every number below comes from the live format configuration that will run real GCC competitions."
            action={
              <Link href="/about" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Read about GCC
              </Link>
            }
          />
          <div className="mt-10">
            <FormatExplainer />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="Competitions"
            title="Tournaments"
            description="Live competitions from organisers on GCC. This section reads real Firestore data on the server."
            action={
              <Link
                href="/tournaments"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                All tournaments
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
          />

          {tournaments.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          ) : (
            <>
              <EmptyState
                className="mt-8"
                icon={ListChecks}
                eyebrow="No published competitions"
                title="The first tournament has not been published yet"
                description="When an organiser opens a competition, it will appear here with its real dates, status and registration count. Nothing is simulated on this page."
                action={
                  <Link href="/about" className={buttonStyles({ size: "sm" })}>
                    See how GCC works
                  </Link>
                }
                secondaryAction={
                  <Link
                    href="/contact"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                  >
                    Talk to the team
                  </Link>
                }
              />

              <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Real dates", value: "Set by the organiser" },
                  { label: "Real entries", value: "Live registration counts" },
                  { label: "Verified results", value: "Recorded with an audit trail" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-electric-300">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-xs text-grey-400">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="container py-16 sm:py-20">
          <EHubMarketPromo />
        </div>
      </section>
    </>
  );
}
