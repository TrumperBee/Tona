// GCC - My tournaments.
//
// One row per server-written membership document. The list is empty until a real
// registration exists, and every label comes from the stored status: a withdrawn
// or removed entry stays visible so the player is never told they never entered.
import { CalendarDays, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getOwnProfile } from "@/lib/profile/server";
import { formatDate } from "@/lib/utils/dates";
import type { MembershipDocument, TournamentStatus } from "@/types/domain";

export const metadata = { title: "My tournaments" };

const FINISHED_STATUSES: readonly TournamentStatus[] = ["completed", "archived", "cancelled"];

interface GroupDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rows: readonly MembershipDocument[];
}

function membershipHref(membership: MembershipDocument): string {
  return `/tournaments/${membership.slug}`;
}

function registeredDate(membership: MembershipDocument): string | null {
  const value = membership.registeredAt;

  if (!value || typeof value.toDate !== "function") {
    return null;
  }

  const date = value.toDate();

  return Number.isNaN(date.getTime()) ? null : formatDate(date);
}

function MembershipCard({ membership }: { readonly membership: MembershipDocument }) {
  const status = TOURNAMENT_STATUS_META[membership.status];
  const registered = registeredDate(membership);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">
              <Link
                href={membershipHref(membership)}
                className="underline-offset-4 hover:underline"
              >
                {membership.name}
              </Link>
            </CardTitle>
            <p className="mt-1 text-xs text-grey-400">
              {getGame(membership.gameId).name}
              {registered ? ` · registered ${registered}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {membership.playerStatus === "withdrawn" ? (
              <Badge tone="warning">You withdrew</Badge>
            ) : null}
            {membership.playerStatus === "removed" ? (
              <Badge tone="danger">Removed by the organiser</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs leading-5 text-grey-400">{status.description}</p>
        <Link
          href={membershipHref(membership)}
          className="text-sm font-semibold text-electric-300 underline-offset-4 hover:underline"
        >
          Open tournament
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function TournamentsPage() {
  const user = await requirePageSignedIn("/dashboard/tournaments");
  const profile = await getOwnProfile(user.userId);

  const memberships = profile?.memberships ?? [];
  const live = memberships.filter((membership) => !FINISHED_STATUSES.includes(membership.status));
  const finished = memberships.filter((membership) =>
    FINISHED_STATUSES.includes(membership.status),
  );

  const groups: readonly GroupDefinition[] = [
    {
      id: "live",
      title: "Live and upcoming",
      description: "Competitions you are entered in that have not finished yet.",
      rows: live,
    },
    {
      id: "finished",
      title: "Finished",
      description: "Completed, archived and cancelled competitions you took part in.",
      rows: finished,
    },
  ].filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player dashboard"
        title="My tournaments"
        description="Every competition you have entered, with its current stage. Entries come from real registrations only."
        actions={
          <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
            Find tournaments
          </Link>
        }
      />

      {memberships.length === 0 ? (
        <EmptyState
          icon={Trophy}
          eyebrow="My tournaments"
          title="You have not entered a tournament yet"
          description="When you register for a real competition, it appears here with its status and a link back to the event."
          action={
            <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
              Browse tournaments
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">{group.title}</h2>
                  <p className="mt-1 text-sm text-grey-400">{group.description}</p>
                </div>
                <p className="text-xs tabular-nums text-grey-500">
                  {group.rows.length} {group.rows.length === 1 ? "entry" : "entries"}
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {group.rows.map((membership) => (
                  <MembershipCard key={membership.tournamentId} membership={membership} />
                ))}
              </div>
            </section>
          ))}

          {memberships.length >= 25 ? (
            <p className="flex items-center gap-2 text-xs text-grey-500">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Showing your 25 most recent entries.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
