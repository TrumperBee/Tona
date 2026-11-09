// GCC - Super Admin user detail.
//
// Combines the private user document, Auth state, memberships, organiser
// applications and audit entries targeting this account. The WhatsApp number is
// masked until an audited reveal.
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  Clock,
  ShieldAlert,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge, StatusBadge } from "@/components/super-admin/badges";
import { RevealContactButton } from "@/components/super-admin/reveal-contact-button";
import { RevokeOrganiserButton } from "@/components/super-admin/revoke-organiser-button";
import { UserStatusActions } from "@/components/super-admin/user-status-actions";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { requirePageSuperAdmin } from "@/lib/auth/page-access";
import { isSuperAdminEmail } from "@/lib/auth/roles";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getServerEnv } from "@/lib/config/env.server";
import { getGame, PLATFORMS } from "@/lib/config/games";
import { maskPhoneNumber } from "@/lib/platform/phone-mask";
import { getUserDetail } from "@/lib/super-admin/users";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { describeAuditAction } from "@/lib/audit/actions";

export const metadata = { title: "User detail" };

interface UserDetailPageProps {
  readonly params: Promise<{ uid: string }>;
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

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { uid } = await params;
  const viewer = await requirePageSuperAdmin(`/super-admin/users/${uid}`);
  const detail = await getUserDetail(uid);

  if (!detail) {
    notFound();
  }

  const user = detail.user;
  const env = getServerEnv();
  const targetIsSuperAdmin =
    user.role === "super_admin" || isSuperAdminEmail(user.email, env.SUPER_ADMIN_EMAIL);
  const isSelf = viewer.userId === uid;
  const canAct = !targetIsSuperAdmin && !isSelf;
  const game = getGame(user.preferredGame);
  const platform = PLATFORMS.find((candidate) => candidate.id === user.platform);
  const maskedWhatsapp = maskPhoneNumber(user.whatsappE164);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/super-admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-grey-400 transition-colors hover:text-white"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Back to users
        </Link>
      </div>

      <PageHeader
        eyebrow="Account detail"
        title={`@${user.gamerTag}`}
        description={user.fullName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role ?? "user"} />
            <StatusBadge status={user.status ?? "active"} />
            {detail.emailVerified ? (
              <Badge tone="success">
                <BadgeCheck aria-hidden="true" className="h-3 w-3" />
                Email verified
              </Badge>
            ) : (
              <Badge tone="warning">Email unverified</Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar name={user.gamerTag} src={user.avatarUrl} size="xl" />
              <div>
                <p className="font-display text-2xl font-semibold uppercase tracking-display text-white">
                  @{user.gamerTag}
                </p>
                <p className="text-sm text-grey-400">{user.fullName}</p>
                <p className="mt-1 text-xs text-grey-500">UID {uid}</p>
              </div>
            </div>

            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Email">{user.email}</Field>
              <Field label="Country">
                {user.country ? `${countryFlag(user.country)} ${countryName(user.country)}` : "—"}
              </Field>
              <Field label="Preferred game">{game.name}</Field>
              <Field label="Platform">{platform?.name ?? "—"}</Field>
              <Field label="Community">{user.community ?? "—"}</Field>
              <Field label="Favourite club">{user.favouriteClub ?? "—"}</Field>
              <Field label="Joined">{formatDate(user.createdAt.toDate())}</Field>
              <Field label="Last profile update">{formatDate(user.updatedAt.toDate())}</Field>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                WhatsApp
              </p>
              <div className="mt-2">
                {maskedWhatsapp ? (
                  <RevealContactButton uid={uid} masked={maskedWhatsapp} />
                ) : (
                  <p className="text-sm text-grey-400">No number stored.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-grey-400">Auth user</span>
                <Badge tone={detail.disabled ? "danger" : "success"}>
                  {detail.disabled ? "Disabled" : "Enabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-grey-400">Email verified</span>
                <span className="text-grey-200">{detail.emailVerified ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-grey-400">Last sign-in</span>
                <span className="text-right text-grey-200">
                  {detail.lastSignInAt ? formatDateTime(detail.lastSignInAt) : "Never"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {targetIsSuperAdmin ? (
                <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger-soft">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  This is the configured Super Admin account. Its role and status cannot be changed
                  from the console.
                </p>
              ) : isSelf ? (
                <p className="text-xs leading-5 text-grey-400">
                  You cannot change your own account status.
                </p>
              ) : (
                <UserStatusActions uid={uid} gamerTag={user.gamerTag} status={user.status} />
              )}

              {canAct && user.role === "organiser" ? (
                <div className="border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs leading-5 text-grey-400">
                    The only manual role action is revoking organiser privileges. Granting the role
                    happens through the Phase 6 application flow.
                  </p>
                  <RevokeOrganiserButton uid={uid} gamerTag={user.gamerTag} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tournaments joined</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.memberships.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Trophy}
                title="No memberships yet"
                description="Tournament memberships appear here when the player enters a competition."
              />
            ) : (
              <ul className="divide-y divide-white/10">
                {detail.memberships.map((membership) => (
                  <li
                    key={membership.tournamentId}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{membership.name}</p>
                      <p className="text-xs text-grey-500">
                        {membership.slug} · registered{" "}
                        {formatDate(membership.registeredAt.toDate())}
                      </p>
                    </div>
                    <Badge tone="neutral">{membership.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organiser applications</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.applications.length === 0 ? (
              <EmptyState
                size="sm"
                icon={ClipboardList}
                title="No applications"
                description="Organiser applications submitted by this account will appear here."
              />
            ) : (
              <ul className="divide-y divide-white/10">
                {detail.applications.map((application) => (
                  <li key={application.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        {application.data.communityName}
                      </p>
                      <Badge
                        tone={
                          application.data.status === "approved"
                            ? "success"
                            : application.data.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {application.data.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-grey-500">
                      {formatDate(application.data.createdAt.toDate())}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <p className="mt-1 text-sm text-grey-400">
            Audit entries where this account is the target.
          </p>
        </CardHeader>
        <CardContent>
          {detail.audit.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Clock}
              title="No recorded actions"
              description="Privileged actions against this account will be recorded here."
            />
          ) : (
            <ol className="divide-y divide-white/10">
              {detail.audit.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {describeAuditAction(entry.data.action)}
                      </p>
                      {entry.data.reason ? (
                        <p className="mt-1 text-xs leading-5 text-grey-400">{entry.data.reason}</p>
                      ) : null}
                    </div>
                    <p className="text-xs text-grey-500">
                      {formatDateTime(entry.data.createdAt.toDate())}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div>
        <Link
          href="/super-admin/users"
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          <UserRound aria-hidden="true" className="h-4 w-4" />
          All users
        </Link>
      </div>
    </div>
  );
}
