// GCC - Super Admin application detail.
//
// Shows every field the applicant submitted, the current account snapshot and
// prior applications. Approve and reject are the only actions, and both are
// re-checked server-side because the page may be stale.
import { ArrowLeft, ClipboardList, ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge, StatusBadge } from "@/components/super-admin/badges";
import { ApplicationReviewActions } from "@/components/super-admin/application-review-actions";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { getApplicationDetail } from "@/lib/applications";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  COMMUNITY_TYPE_LABELS,
  EXPECTED_PLAYER_LABELS,
} from "@/lib/applications/labels";
import { requirePageSuperAdmin } from "@/lib/auth/page-access";
import { GAMES } from "@/lib/config/games";
import { formatDateTime } from "@/lib/utils/dates";
import type { AdminApplicationDocument } from "@/types/domain";

export const metadata = { title: "Application detail" };

interface ApplicationDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-grey-200">{children}</dd>
    </div>
  );
}

function gameNames(games: AdminApplicationDocument["gamesPlanned"]): string {
  const names = games
    .map((gameId) => GAMES.find((game) => game.id === gameId)?.name ?? gameId)
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "None recorded";
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  await requirePageSuperAdmin(`/super-admin/applications/${id}`);

  let detail: Awaited<ReturnType<typeof getApplicationDetail>>;

  try {
    detail = await getApplicationDetail(id);
  } catch {
    notFound();
  }

  const application = detail.application;
  const applicant = detail.user;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super Admin console"
        title={`@${application.gamerTag}`}
        description={`Application from ${application.communityName}.`}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Applications", href: "/super-admin/applications" },
          { label: application.gamerTag },
        ]}
        actions={
          <Link
            href="/super-admin/applications"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to queue
          </Link>
        }
      />

      <Card variant="elevated">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{application.communityName}</CardTitle>
            <p className="mt-1 text-xs text-grey-500">
              Submitted {formatDateTime(application.createdAt.toDate())}
            </p>
          </div>
          <Badge tone={APPLICATION_STATUS_TONES[application.status]}>
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {application.status === "pending" ? (
            <ApplicationReviewActions applicationId={id} gamerTag={application.gamerTag} />
          ) : null}

          {detail.disabled ? (
            <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-soft">
              <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This applicant&apos;s Auth account is disabled. Approval will be refused until it is
                restored.
              </p>
            </div>
          ) : null}

          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label="Community type">{COMMUNITY_TYPE_LABELS[application.communityType]}</Field>
            <Field label="Community link">
              {application.communityLink ? (
                <a
                  href={application.communityLink}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 font-semibold text-electric-300 hover:underline"
                >
                  Open link
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : (
                "Not provided"
              )}
            </Field>
            <Field label="Expected players">
              {EXPECTED_PLAYER_LABELS[application.expectedPlayers]}
            </Field>
            <Field label="Games planned">{gameNames(application.gamesPlanned)}</Field>
            <Field label="Agreed to organiser code">
              {application.agreesToRules ? "Yes" : "No"}
            </Field>
            <Field label="Reviewed at">
              {application.reviewedAt ? formatDateTime(application.reviewedAt.toDate()) : "-"}
            </Field>
            <Field label="Reviewed by">
              {application.reviewedBy ? (
                <span className="font-mono text-xs">{application.reviewedBy}</span>
              ) : (
                "-"
              )}
            </Field>
            <Field label="Review note">{application.reviewNote ?? "-"}</Field>
          </dl>

          <div className="grid gap-6 border-t border-white/10 pt-6 lg:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Experience
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-grey-300">
                {application.experience}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                Motivation
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-grey-300">
                {application.motivation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applicant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={application.gamerTag} src={applicant?.avatarUrl ?? null} />
              <div>
                <p className="font-semibold text-white">@{application.gamerTag}</p>
                <p className="text-xs text-grey-500">{application.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {applicant ? (
                <>
                  <RoleBadge role={applicant.role ?? "user"} />
                  <StatusBadge status={applicant.status} />
                </>
              ) : (
                <Badge tone="warning">Profile missing</Badge>
              )}
              {detail.disabled ? <Badge tone="danger">Auth disabled</Badge> : null}
            </div>
          </div>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <Field label="Snapshot gamer tag">{application.gamerTag}</Field>
            <Field label="Snapshot email">{application.email}</Field>
            <Field label="Full name">{applicant?.fullName ?? "-"}</Field>
            <Field label="Country">{applicant?.country ?? "-"}</Field>
          </dl>
          <div className="mt-5">
            <Link
              href={`/super-admin/users/${application.uid}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Open full user record
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous applications</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.previous.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              eyebrow="No history"
              title="This is the applicant's first application"
              description="Earlier applications, if any, appear here with their own status and review note."
            />
          ) : (
            <ul className="divide-y divide-white/10">
              {detail.previous.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <Link
                      href={`/super-admin/applications/${entry.id}`}
                      className="font-semibold text-white hover:text-electric-300"
                    >
                      {entry.data.communityName}
                    </Link>
                    <p className="text-xs text-grey-500">
                      {formatDateTime(entry.data.createdAt.toDate())}
                      {entry.data.reviewNote ? ` - ${entry.data.reviewNote}` : ""}
                    </p>
                  </div>
                  <Badge tone={APPLICATION_STATUS_TONES[entry.data.status]}>
                    {APPLICATION_STATUS_LABELS[entry.data.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
