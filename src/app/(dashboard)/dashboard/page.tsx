// GCC - participant dashboard overview.
// Real Firestore data only: the profile, memberships and zeroed statistics that
// the server has actually written. Empty states explain what will appear.
import { CalendarDays, Compass, UserRound } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { VerificationBanner } from "@/components/shared/verification-banner";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, StatCard } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getOwnProfile } from "@/lib/profile/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePageSignedIn("/dashboard");
  const profile = await getOwnProfile(user.userId);

  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
        eyebrow="Profile"
        title="Your profile document is missing"
        description="Your sign-in works, but the server could not find your player profile. Contact the GCC team so the account can be repaired."
        action={
          <Link href="/contact" className={buttonStyles({ size: "sm" })}>
            Contact the team
          </Link>
        }
      />
    );
  }

  const { user: privateProfile, publicProfile, memberships } = profile;
  const stats = publicProfile?.stats.overall;
  const game = getGame(privateProfile.preferredGame);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player dashboard"
        title={`Welcome, @${privateProfile.gamerTag}`}
        description={`${game.name} · ${privateProfile.country}. Your competitions and next actions appear here.`}
        actions={
          <Link href="/dashboard/profile" className={buttonStyles({ size: "sm" })}>
            View profile
          </Link>
        }
      />

      {!user.emailVerified ? <VerificationBanner /> : null}

      <section>
        <SectionHeading
          title="Your record"
          description="Every value comes from your public profile. New accounts start at zero and stay there until an admin records a real match."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tournaments" value={stats?.tournaments ?? 0} />
          <StatCard label="Matches played" value={stats?.played ?? 0} />
          <StatCard label="Wins" value={stats?.wins ?? 0} />
          <StatCard
            label="Win rate"
            value={
              stats && stats.played > 0
                ? `${Math.round((stats.wins / stats.played) * 100)}%`
                : "Unranked"
            }
            hint={
              stats && stats.played > 0
                ? "From recorded matches."
                : "Appears after matches are recorded."
            }
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Quick links" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Link href="/dashboard/profile" className="group">
            <Card className="h-full transition-colors group-hover:border-electric-400/40">
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                Your avatar, gamer tag, country, game and contact settings.
              </CardContent>
            </Card>
          </Link>
          <Link href="/tournaments" className="group">
            <Card className="h-full transition-colors group-hover:border-electric-400/40">
              <CardHeader>
                <CardTitle className="text-lg">Find tournaments</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                Browse competitions that are open for entry right now.
              </CardContent>
            </Card>
          </Link>
          <Link href="/players" className="group">
            <Card className="h-full transition-colors group-hover:border-electric-400/40">
              <CardHeader>
                <CardTitle className="text-lg">Players</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                Search real public profiles by gamer-tag prefix.
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      <section>
        <SectionHeading
          title="My tournaments"
          action={
            <Link
              href="/tournaments"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Find tournaments
            </Link>
          }
        />
        <div className="mt-5">
          {memberships.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
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
            <div className="grid gap-4 sm:grid-cols-2">
              {memberships.map((membership) => {
                const status = TOURNAMENT_STATUS_META[membership.status];

                return (
                  <Card key={membership.tournamentId}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{membership.name}</CardTitle>
                          <p className="mt-1 text-xs text-grey-500">
                            {getGame(membership.gameId).name}
                          </p>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/tournaments/${membership.slug}`}
                        className="text-sm font-semibold text-electric-300 underline-offset-4 hover:underline"
                      >
                        Open tournament
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title="Match history" />
        <div className="mt-5">
          <EmptyState
            icon={Compass}
            eyebrow="Match history"
            title="No recorded matches yet"
            description="Match history is built from results entered by tournament admins. It stays empty until your first real match is recorded."
          />
        </div>
      </section>
    </div>
  );
}
