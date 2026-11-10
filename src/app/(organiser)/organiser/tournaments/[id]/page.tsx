// GCC - tournament workspace overview.
//
// The layout above renders the guard, header, lifecycle stepper and tool tabs.
// This page answers one question honestly: what is the next real step for this
// competition right now?
import { ArrowRight, CalendarClock, CircleDot, Info } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getTournamentWorkspace } from "@/lib/organiser/workspace-access";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

export const metadata = { title: "Tournament overview" };

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

interface ChecklistStep {
  readonly label: string;
  readonly href: string | null;
  readonly note: string;
}

function nextSteps(id: string, tournament: TournamentDocument): readonly ChecklistStep[] {
  const base = `/organiser/tournaments/${id}`;
  const status: TournamentStatus = tournament.status;

  switch (status) {
    case "draft":
      return [
        {
          label: "Complete the competition details",
          href: `${base}/settings`,
          note: "Name, game, format, dates, rules and field size. The details tool opens with the organiser tools.",
        },
        {
          label: "Open registration",
          href: null,
          note: "Opening registration is a recorded status change; it arrives with the organiser tools.",
        },
      ];
    case "registration_open":
      return [
        {
          label: "Monitor registrations",
          href: `${base}/registrations`,
          note: `${tournament.registrationCount} / ${tournament.maxParticipants} entrants recorded by the platform.`,
        },
        {
          label: "Close registration when the field is set",
          href: null,
          note: tournament.registrationClosesAt
            ? `The published window closes ${formatDateTime(tournament.registrationClosesAt.toDate())}.`
            : "No closing time is published yet. Closing registration is a recorded status change.",
        },
      ];
    case "registration_closed":
      return [
        {
          label: "Confirm the field and draw the pots",
          href: `${base}/pots`,
          note: `${tournament.registrationCount} entrants are recorded. The four pots of nine are confirmed before fixtures.`,
        },
      ];
    case "pots_confirmed":
      return [
        {
          label: "Build and publish the fixture schedule",
          href: `${base}/fixtures`,
          note: "The 36-team league schedule is generated from the confirmed pots.",
        },
      ];
    case "fixtures_published":
    case "league_phase":
      return [
        {
          label: "Record results as matchdays are played",
          href: `${base}/results`,
          note: "Standings are computed from verified results only.",
        },
        {
          label: "Watch for result reports",
          href: `${base}/result-reports`,
          note: "Players can flag problems with recorded results for your review.",
        },
      ];
    case "knockout":
      return [
        {
          label: "Record knockout results",
          href: `${base}/knockout`,
          note: "The bracket and each tie are recorded until the final is played.",
        },
      ];
    case "completed":
      return [
        {
          label: "Competition complete",
          href: null,
          note: "The champion is recorded. Archiving preserves the season permanently; it arrives with the organiser tools.",
        },
      ];
    case "archived":
      return [
        {
          label: "Season archived",
          href: null,
          note: "This competition is preserved read-only in the archives. No further operational steps exist.",
        },
      ];
    case "cancelled":
      return [
        {
          label: "Competition cancelled",
          href: null,
          note: "Entrants keep their records for this competition. A cancelled competition never resumes.",
        },
      ];
    case "suspended":
      return [
        {
          label: "Suspended pending platform review",
          href: null,
          note: "The competition is paused by the platform. The exact stage is restored after the review.",
        },
      ];
  }
}

export default async function TournamentOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const { tournament } = await getTournamentWorkspace(id);
  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const steps = nextSteps(id, tournament);

  const dates: readonly { readonly label: string; readonly value: string }[] = [
    tournament.registrationOpensAt
      ? {
          label: "Registration opens",
          value: formatDateTime(tournament.registrationOpensAt.toDate()),
        }
      : { label: "Registration opens", value: "Not published" },
    tournament.registrationClosesAt
      ? {
          label: "Registration closes",
          value: formatDateTime(tournament.registrationClosesAt.toDate()),
        }
      : { label: "Registration closes", value: "Not published" },
    tournament.startsAt
      ? { label: "Competition starts", value: formatDate(tournament.startsAt.toDate()) }
      : { label: "Competition starts", value: "Not published" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot aria-hidden="true" className="h-4 w-4 text-electric-300" />
            Next step for this competition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-grey-300">{meta.description}</p>

          <ul className="mt-4 space-y-3">
            {steps.map((step) => (
              <li key={step.label} className="rounded-lg border border-white/10 bg-navy-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className={buttonStyles({ variant: "secondary", size: "sm" })}
                    >
                      Go
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm leading-6 text-grey-400">{step.note}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-start">
        <Card variant="outline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="h-4 w-4 text-gold-300" />
              Key dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {dates.map((date) => (
                <div key={date.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                    {date.label}
                  </dt>
                  <dd className="text-right text-grey-200">{date.value}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                  Time zone
                </dt>
                <dd className="text-right text-grey-200">{tournament.timezone || "UTC"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                  Match length
                </dt>
                <dd className="text-right text-grey-200">
                  {tournament.matchDurationMinutes
                    ? `${tournament.matchDurationMinutes} minutes`
                    : "Not published"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {tournament.description ? (
          <Card variant="outline">
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-7 text-grey-300">
                {tournament.description}
              </p>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            size="sm"
            icon={Info}
            title="No description yet"
            description="The organiser has not published a description for this competition. It will appear here once written."
          />
        )}
      </div>
    </div>
  );
}
