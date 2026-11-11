// GCC - tournament entry confirmation.
//
// The last step before an entry is recorded: key details, the full published
// rules and an explicit acceptance checkbox. Gating (sign-in, account status,
// already registered, the effective state) is decided on the server before the
// form ever renders.
import { ArrowLeft, Ban, CheckCircle2, ClipboardCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { OrganisedBy } from "@/components/tournament/organised-by";
import { RegisterForm } from "@/components/tournament/register-form";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { getCurrentUser } from "@/lib/auth/guards";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getPublicTournamentBySlug, getViewerRegistration } from "@/lib/data/public-tournaments";
import { formatDateTime } from "@/lib/utils/dates";
import { getRegistrationState } from "@/lib/tournament/registration-state";

interface RegisterPageProps {
  readonly params: Promise<{ slug: string }>;
}

const getTournament = cache(getPublicTournamentBySlug);

export async function generateMetadata({ params }: RegisterPageProps) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  return {
    title: tournament ? `Register for ${tournament.name}` : "Tournament registration",
  };
}

export default async function TournamentRegisterPage({ params }: RegisterPageProps) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  if (!tournament) {
    notFound();
  }

  const game = getGame(tournament.gameId);
  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const timezone = tournament.timezone;
  const state = getRegistrationState(tournament, new Date());
  const user = await getCurrentUser();

  const unavailable = (title: string, description: string) => (
    <EmptyState
      icon={ClipboardCheck}
      eyebrow="No entry possible"
      title={title}
      description={description}
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
  );

  let gating: React.ReactNode | null = null;

  if (state === "cancelled") {
    gating = unavailable(
      "This competition was cancelled",
      "The organiser cancelled this competition. It is not accepting entries.",
    );
  } else if (!user) {
    // Hand the player to sign-in and bring them straight back here.
    redirect(`/login?next=${encodeURIComponent(`/tournaments/${slug}/register`)}`);
  } else {
    const viewerRegistration = await getViewerRegistration(tournament.id, user.userId);

    if (viewerRegistration) {
      gating = (
        <EmptyState
          icon={CheckCircle2}
          eyebrow="Already registered"
          title="You are already in this competition"
          description="Your place is held. You can withdraw from the tournament page while registration stays open."
          action={
            <Link href={`/tournaments/${tournament.slug}`} className={buttonStyles({ size: "sm" })}>
              Back to tournament
            </Link>
          }
        />
      );
    } else if (state === "opens_soon") {
      gating = unavailable(
        "Registration has not opened yet",
        `Registration opens ${
          tournament.registrationOpensAt
            ? formatDateTime(tournament.registrationOpensAt, { timeZone: timezone })
            : "soon"
        }. The tournament page counts down to it.`,
      );
    } else if (state === "full") {
      gating = unavailable(
        "The field is full",
        `All ${tournament.maxParticipants} places are taken. A withdrawn place reopens automatically while registration stays open.`,
      );
    } else if (state === "closed") {
      gating = unavailable(
        "The entry window has closed",
        `${meta.description} No new entry can be recorded for this competition.`,
      );
    }
  }

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Registration"
            title={tournament.name}
            description="Confirm your entry. One click records it on the platform — nothing is collected through third parties."
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

          <div className="mt-4">
            <OrganisedBy ownerUid={tournament.ownerUid} />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          {gating ?? (
            <div className="mx-auto max-w-2xl">
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-electric-400/20 bg-electric-500/5 p-4">
                <UserCheck
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-electric-300"
                />
                <div className="text-sm leading-6 text-grey-300">
                  <p className="font-semibold text-white">
                    You are about to enter this competition.
                  </p>
                  <p className="mt-1">
                    {tournament.registrationClosesAt
                      ? `Registration closes ${formatDateTime(tournament.registrationClosesAt, {
                          timeZone: timezone,
                        })} (${timezone}).`
                      : "Check the tournament page for the registration window."}{" "}
                    {tournament.startsAt
                      ? `Play starts ${formatDateTime(tournament.startsAt, { timeZone: timezone })}.`
                      : null}
                  </p>
                </div>
              </div>

              <Card variant="outline" className="mb-6">
                <CardHeader>
                  <CardTitle>Published rules</CardTitle>
                </CardHeader>
                <CardContent>
                  {tournament.rules ? (
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <p className="whitespace-pre-line text-sm leading-7 text-grey-300">
                        {tournament.rules}
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-sm leading-6 text-grey-400">
                      <Ban aria-hidden="true" className="h-4 w-4 text-warning" />
                      This competition has no published rules. Entries cannot be accepted until the
                      organiser publishes them — contact the organiser if you believe this is an
                      error.
                    </p>
                  )}
                </CardContent>
              </Card>

              {tournament.rules ? (
                <RegisterForm tournamentId={tournament.id} slug={tournament.slug} />
              ) : (
                unavailable(
                  "Rules are missing",
                  "An entry requires the organiser's published rules. Nothing is recorded from this page.",
                )
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
