// GCC - about the platform.
// Static product copy only; every claim matches what is built or planned.
import {
  ArrowRight,
  CalendarCheck,
  CircleDot,
  ListChecks,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

import { EHubMarketPromo } from "@/components/marketplace/ehubmarket-promo";
import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UCL_LEAGUE_PHASE_36 } from "@/lib/config/formats";

export const metadata = {
  title: "About",
  description:
    "GCC is independent tournament infrastructure for football gaming communities: fair draws, verified results and permanent records.",
};

const principles = [
  {
    title: "Trustworthy",
    description:
      "Results are verified, standings are calculated on the server and every privileged change is written to an audit log. The browser never decides a score.",
    icon: ShieldCheck,
  },
  {
    title: "Fair",
    description:
      "Fixtures are generated against explicit constraints and validated before publication. Pots are drawn without country restrictions.",
    icon: CircleDot,
  },
  {
    title: "Permanent",
    description:
      "Completed seasons are never hard-deleted. Champions, standings and Hall of Fame entries survive rule changes, redesigns and new formats.",
    icon: Trophy,
  },
  {
    title: "Open to communities",
    description:
      "Any registered player can compete. Any player can apply to organise, subject to review. Approval is a role, not a hidden checkbox.",
    icon: Users,
  },
] as const;

const formatFacts = [
  { label: "Participants", value: UCL_LEAGUE_PHASE_36.participants },
  { label: "Pots", value: `${UCL_LEAGUE_PHASE_36.pots.count} × ${UCL_LEAGUE_PHASE_36.pots.size}` },
  { label: "Matches per player", value: UCL_LEAGUE_PHASE_36.matchesPerParticipant },
  { label: "Matchdays", value: UCL_LEAGUE_PHASE_36.matchdays },
  { label: "League matches", value: UCL_LEAGUE_PHASE_36.totalMatches },
  {
    label: "Home / away",
    value: `${UCL_LEAGUE_PHASE_36.homeMatches} / ${UCL_LEAGUE_PHASE_36.awayMatches}`,
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 bg-hero-glow" />
        <div className="container relative py-14 sm:py-20">
          <PageHeader
            eyebrow="About GCC"
            title="A permanent home for community competition"
            description={
              <>
                Global Champions Circuit is independent tournament infrastructure for football
                gaming communities. It replaces the spreadsheet, the group chat and the lost
                screenshot with one platform for draws, fixtures, verified results and a record that
                outlives the season.
              </>
            }
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
            actions={
              <>
                <Link href="/tournaments" className={buttonStyles({ size: "md" })}>
                  Browse tournaments
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className={buttonStyles({ variant: "secondary", size: "md" })}
                >
                  Contact the team
                </Link>
              </>
            }
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-14 sm:py-20">
          <SectionHeading
            eyebrow="Why it exists"
            title="Community tournaments deserve real infrastructure"
            description="Spreadsheets work until a competition grows. Then fixtures collide, tables are calculated by hand, result reports disappear into chat history and past seasons are impossible to revisit."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {principles.map((principle) => {
              const Icon = principle.icon;

              return (
                <Card key={principle.title} className="h-full p-5">
                  <div className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-semibold uppercase tracking-display text-white">
                        {principle.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-grey-400">
                        {principle.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-14 sm:py-20">
          <SectionHeading
            eyebrow="The format"
            title="One format at launch, built to be understood"
            description="GCC launches with a single 36-team league phase. Every number below is read from the same format configuration the competition engine will use."
            action={
              <Link
                href="/#how-it-works"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                See the full explainer
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Card variant="elevated" className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="info">Launch format</Badge>
                <Badge tone="gold">{UCL_LEAGUE_PHASE_36.participants} teams</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-grey-300">
                {UCL_LEAGUE_PHASE_36.description}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {formatFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-lg border border-white/10 bg-navy-950/60 p-3"
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 font-display text-2xl font-semibold text-white">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card variant="outline" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                What the league phase decides
              </p>
              <ul className="mt-4 space-y-2.5">
                {UCL_LEAGUE_PHASE_36.qualification.map((band) => (
                  <li
                    key={band.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-navy-900/40 px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-11 place-items-center rounded-md bg-navy-950/70 font-display text-sm font-semibold tabular-nums text-white">
                        {Number(band.fromPosition) === Number(band.toPosition)
                          ? band.fromPosition
                          : `${band.fromPosition}–${band.toPosition}`}
                      </span>
                      <span className="text-sm font-semibold text-white">{band.label}</span>
                    </span>
                    <span className="text-right text-xs text-grey-400">
                      {band.destination === "round-of-16"
                        ? "Direct entry"
                        : band.destination === "eliminated"
                          ? "Season ends"
                          : "Two-legged play-off"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-grey-500">
                Positions are decided by the league table after matchday{" "}
                {UCL_LEAGUE_PHASE_36.matchdays}. Knockout ties are generated from those positions,
                not chosen by hand.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-14 sm:py-20">
          <SectionHeading
            eyebrow="Who it is for"
            title="Players compete. Organisers run the competition."
            description="Two roles, one record. A participant keeps the same identity and career history across every tournament they enter."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                    <Swords aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>For players</CardTitle>
                    <p className="mt-1 text-sm text-grey-400">
                      Enter with one identity, follow every fixture.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-sm text-grey-300">
                  {[
                    "Register a gamer tag, country, game and platform once.",
                    "See your fixtures, deadlines and verified results in one place.",
                    "Build a permanent record of matches, goals and titles.",
                    "Apply to organise when your community is ready.",
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <CalendarCheck
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-electric-300"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-gold-400/25 bg-gold-400/10 text-gold-300">
                    <ListChecks aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>For organisers</CardTitle>
                    <p className="mt-1 text-sm text-grey-400">
                      Run a full season without a spreadsheet.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-sm text-grey-300">
                  {[
                    "Create a competition and publish its rules and dates.",
                    "Review registrations and confirm the field of 36.",
                    "Confirm pots, generate fixtures and publish them once.",
                    "Record admin-entered results, review result reports and preserve the season.",
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <CalendarCheck
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-gold-300"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                Independence
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
                Not a governing body. Not a publisher service.
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-grey-300">
                <p>
                  GCC is an independent competition platform. It is not affiliated with, endorsed by
                  or sponsored by UEFA, any football governing body, any game publisher or any
                  professional league.
                </p>
                <p>
                  Game names such as eFootball, EA SPORTS FC and Dream League Soccer belong to their
                  respective owners and are used only to describe the titles a competition supports.
                  The 36-team league phase is a competitive structure, not an official competition
                  identity.
                </p>
                <p>
                  GCC does not sell players, accounts or in-game items. The eHubMarket link in the
                  footer and on the home page leads to an independent marketplace partner in a new
                  tab.
                </p>
              </div>
            </div>

            <Card variant="gold" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                Where the platform stands
              </p>
              <p className="mt-3 text-sm leading-7 text-grey-200">
                This public site is live. Accounts, competition creation and result verification are
                being built next. Until they open, no tournament, player or score is simulated here.
              </p>
              <p className="mt-3 text-sm leading-7 text-grey-400">
                When a tournament is published, it appears on the tournaments page with its real
                dates, status and registration count — sourced directly from the platform database.
              </p>
              <div className="mt-5">
                <Link
                  href="/tournaments"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  See what is published
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section>
        <div className="container py-14 sm:py-20">
          <EHubMarketPromo />
        </div>
      </section>
    </>
  );
}
