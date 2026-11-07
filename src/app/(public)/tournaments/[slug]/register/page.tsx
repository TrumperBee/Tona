// GCC - tournament registration information.
// No registration form exists in Phase 3. The page reads the real tournament
// status and explains what is required without collecting anything.
import { ArrowLeft, ClipboardCheck, ListChecks, UserCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getPublicTournamentBySlug } from "@/lib/data/public-tournaments";
import { formatDateTime, isIanaTimezone } from "@/lib/utils/dates";

interface RegisterPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps) {
  const { slug } = await params;
  const tournament = await getPublicTournamentBySlug(slug);

  return {
    title: tournament ? `Register for ${tournament.name}` : "Tournament registration",
  };
}

const requirements = [
  {
    title: "A verified GCC account",
    description:
      "One account per person. Your email must be verified before a tournament entry is accepted.",
    icon: UserCheck,
  },
  {
    title: "A complete player identity",
    description:
      "Gamer tag, country, preferred game and platform. Your gamer tag is how opponents recognise you.",
    icon: ClipboardCheck,
  },
  {
    title: "The tournament requirements",
    description:
      "The correct game and platform, and acceptance of the organiser's published rules and schedule.",
    icon: ListChecks,
  },
] as const;

export default async function TournamentRegisterPage({ params }: RegisterPageProps) {
  const { slug } = await params;
  const tournament = await getPublicTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const game = getGame(tournament.gameId);
  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const timezone = isIanaTimezone(tournament.timezone) ? tournament.timezone : "UTC";
  const registrationOpen = tournament.status === "registration_open";

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Registration"
            title={tournament.name}
            description="What entering this competition requires, and what happens next. No entry form is open on this page."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: tournament.name, href: `/tournaments/${tournament.slug}` },
              { label: "Register" },
            ]}
            actions={
              <Link
                href={`/tournaments/${tournament.slug}`}
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Tournament details
              </Link>
            }
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{game.name}</Badge>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Badge tone="neutral">
              {tournament.registrationCount} / {tournament.maxParticipants} registered
            </Badge>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          {registrationOpen ? (
            <EmptyState
              icon={ClipboardCheck}
              eyebrow="Entry not yet open on the platform"
              title="In-platform registration is not available yet"
              description={
                <>
                  This competition is marked as open for registration, but the account and entry
                  flow is not live. There is no form to submit, and no entry is being recorded from
                  this page. When the flow opens, registration will be completed inside your GCC
                  dashboard.
                </>
              }
              action={
                <Link href="/login" className={buttonStyles({ size: "sm" })}>
                  About GCC accounts
                </Link>
              }
              secondaryAction={
                <Link
                  href={`/tournaments/${tournament.slug}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Back to tournament
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              eyebrow="Registration closed"
              title={
                tournament.status === "registration_closed" ||
                tournament.status === "pots_confirmed"
                  ? "The entry window has closed"
                  : tournament.status === "suspended"
                    ? "This competition is suspended"
                    : "This competition is not accepting entries"
              }
              description={
                <>
                  {meta.description} Registration details remain visible so participants can see the
                  field size and schedule, but no new entry can be created.
                </>
              }
              action={
                <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                  Browse other tournaments
                </Link>
              }
              secondaryAction={
                <Link
                  href={`/tournaments/${tournament.slug}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Tournament details
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-start">
            <div>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-display text-white sm:text-3xl">
                What you will need
              </h2>
              <div className="mt-5 space-y-3">
                {requirements.map((requirement) => {
                  const Icon = requirement.icon;

                  return (
                    <Card key={requirement.title} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">{requirement.title}</p>
                          <p className="mt-1 text-sm leading-6 text-grey-400">
                            {requirement.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Card variant="outline">
              <CardHeader>
                <CardTitle>Key dates</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {tournament.registrationClosesAt ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                        Registration closes
                      </dt>
                      <dd className="mt-0.5 text-grey-200">
                        {formatDateTime(tournament.registrationClosesAt, {
                          timeZone: timezone,
                        })}{" "}
                        <span className="text-grey-500">({timezone})</span>
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                      Competition starts
                    </dt>
                    <dd className="mt-0.5 text-grey-200">
                      {tournament.startsAt
                        ? `${formatDateTime(tournament.startsAt, { timeZone: timezone })}`
                        : "To be confirmed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                      Match length
                    </dt>
                    <dd className="mt-0.5 text-grey-200">
                      {tournament.matchDurationMinutes
                        ? `${tournament.matchDurationMinutes} minutes`
                        : "To be confirmed"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-grey-500">
                  Do not send entry fees, account details or passwords to anyone claiming to
                  register you manually. Entry is only valid when it is recorded by the platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
