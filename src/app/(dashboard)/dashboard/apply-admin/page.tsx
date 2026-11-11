// GCC - apply to become an organiser.
//
// The page shows the applicant's real application state and cooldown. It never
// renders a form when a pending application already exists, and organisers or
// Super Admins are told that the applicant flow does not apply to them.
import { CheckCircle2, Clock3, Shield, XCircle } from "lucide-react";
import Link from "next/link";

import { ApplicationForm } from "@/components/applications/application-form";
import { WithdrawApplicationButton } from "@/components/applications/withdraw-application-button";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { getApplicantApplicationContext } from "@/lib/applications";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import type { AdminApplicationDocument } from "@/types/domain";

export const metadata = { title: "Apply as organiser" };

function statusLabel(status: AdminApplicationDocument["status"]): string {
  switch (status) {
    case "pending":
      return "Pending review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Not approved";
    case "withdrawn":
      return "Withdrawn";
    case "revoked":
      return "Revoked";
  }
}

function statusTone(
  status: AdminApplicationDocument["status"],
): "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
    case "revoked":
      return "danger";
    case "withdrawn":
      return "neutral";
  }
}

export default async function ApplyAdminPage() {
  const user = await requirePageSignedIn("/dashboard/apply-admin");

  if (user.role !== "user") {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Player dashboard"
          title="Organiser application"
          description="Organiser applications are for participant accounts."
        />
        <Card variant="gold">
          <CardContent className="flex items-start gap-4 p-6">
            <Shield aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-gold-300" />
            <div>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-display text-white">
                You already hold an organiser role
              </h2>
              <p className="mt-2 text-sm leading-6 text-grey-300">
                {user.role === "super_admin"
                  ? "Super Admin accounts cannot apply through the organiser flow."
                  : "Use the organiser workspace to create and run competitions."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={user.role === "super_admin" ? "/super-admin" : "/organiser"}
                  className={buttonStyles({ size: "sm" })}
                >
                  Open workspace
                </Link>
                <Link
                  href="/dashboard"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const context = await getApplicantApplicationContext(user.userId);
  const latest = context.latest?.data ?? null;
  const canApply =
    !latest ||
    latest.status === "withdrawn" ||
    latest.status === "revoked" ||
    (latest.status === "rejected" && context.cooldown.allowed);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player dashboard"
        title="Apply to become an organiser"
        description="Organisers run competitions for their community. Every application is reviewed by the Super Admin before the role is granted."
        actions={
          <Link
            href="/organiser-code"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Read the organiser code
          </Link>
        }
      />

      {latest ? (
        <Card variant={latest.status === "approved" ? "gold" : "default"}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{latest.communityName}</CardTitle>
              <p className="mt-1 text-xs text-grey-500">
                Submitted {formatDateTime(latest.createdAt.toDate())}
              </p>
            </div>
            <Badge tone={statusTone(latest.status)}>{statusLabel(latest.status)}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-grey-300">
            {latest.status === "pending" ? (
              <>
                <p className="flex items-start gap-2">
                  <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  Your application is in the review queue. The Super Admin sees pending applications
                  oldest first.
                </p>
                <WithdrawApplicationButton applicationId={context.latest?.id ?? ""} />
              </>
            ) : null}

            {latest.status === "approved" ? (
              <>
                <p className="flex items-start gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                  />
                  Your application was approved
                  {latest.reviewedAt ? ` on ${formatDate(latest.reviewedAt.toDate())}` : ""}.
                </p>
                {latest.reviewNote ? (
                  <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <span className="font-semibold text-white">Note from the Super Admin: </span>
                    {latest.reviewNote}
                  </p>
                ) : null}
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-semibold text-white">Next steps</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Sign out and sign in again so your new organiser role is active.</li>
                    <li>Open the organiser workspace.</li>
                    <li>Create only the competitions you are ready to run fairly.</li>
                  </ol>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/login?next=%2Forganiser" className={buttonStyles({ size: "sm" })}>
                    Sign in again
                  </Link>
                  {user.role !== "user" ? (
                    <Link
                      href="/organiser"
                      className={buttonStyles({ variant: "secondary", size: "sm" })}
                    >
                      Open organiser workspace
                    </Link>
                  ) : null}
                </div>
              </>
            ) : null}

            {latest.status === "rejected" ? (
              <>
                <p className="flex items-start gap-2">
                  <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  This application was not approved
                  {latest.reviewedAt ? ` on ${formatDate(latest.reviewedAt.toDate())}` : ""}.
                </p>
                {latest.reviewNote ? (
                  <p className="rounded-md border border-danger/20 bg-danger/[0.06] p-3">
                    <span className="font-semibold text-white">Reason: </span>
                    {latest.reviewNote}
                  </p>
                ) : null}
                <p>
                  {context.cooldown.allowed || !context.cooldown.reapplyAt
                    ? "You can submit a new application now."
                    : `You can reapply from ${formatDateTime(context.cooldown.reapplyAt)}.`}
                </p>
              </>
            ) : null}

            {latest.status === "withdrawn" ? (
              <p className="flex items-start gap-2">
                <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-grey-400" />
                You withdrew this application. You can submit a new one when you are ready.
              </p>
            ) : null}

            {latest.status === "revoked" ? (
              <>
                <p className="flex items-start gap-2">
                  <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  This approval was revoked by the Super Admin
                  {latest.reviewedAt ? ` on ${formatDate(latest.reviewedAt.toDate())}` : ""}.
                </p>
                {latest.reviewNote ? (
                  <p className="rounded-md border border-danger/20 bg-danger/[0.06] p-3">
                    <span className="font-semibold text-white">Reason: </span>
                    {latest.reviewNote}
                  </p>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canApply ? <ApplicationForm /> : null}

      {latest?.status === "rejected" && !context.cooldown.allowed && context.cooldown.reapplyAt ? (
        <p className="text-sm text-grey-400">
          The form reopens on {formatDate(context.cooldown.reapplyAt)}.
        </p>
      ) : null}
    </div>
  );
}
