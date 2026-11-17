// GCC - head-to-head between two public players.
//
// Encounters are completed matches only, read through the shared bounded query
// in the statistics server module. A missing tournament, an unknown tag or a
// suspended account produces an honest explanation, never a guessed result.
import { ArrowRight, Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { PlayerPicker } from "@/components/profile/player-picker";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Pagination } from "@/components/ui/pagination";
import { getGame } from "@/lib/config/games";
import { getPublicPlayerByGamerTag, type PublicPlayerProfile } from "@/lib/profile/server";
import { getHeadToHead, type HeadToHeadEncounter } from "@/lib/stats/server";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDate } from "@/lib/utils/dates";

export const metadata = {
  title: "Head-to-head",
  description:
    "Compare two GCC players from their recorded meetings: wins, draws, goals and every encounter in order.",
};

const STAGE_LABELS: Readonly<Record<string, string>> = {
  league: "League",
  playoff: "Play-off",
  r16: "Round of 16",
  qf: "Quarter-final",
  sf: "Semi-final",
  final: "Final",
};

interface ComparePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function usablePlayer(
  player: PublicPlayerProfile | null,
  tag: string | null,
): PublicPlayerProfile | null {
  if (!player || player.status !== "active" || !tag) return null;
  return player;
}

function compareHref(input: {
  readonly a: string;
  readonly b: string;
  readonly page?: number;
}): string {
  const params = new URLSearchParams({ a: input.a, b: input.b });

  if (input.page && input.page > 1) params.set("page", String(input.page));

  return `/players/compare?${params.toString()}`;
}

function EncounterRow({ encounter }: { readonly encounter: HeadToHeadEncounter }) {
  const outcome =
    encounter.aGoals > encounter.bGoals
      ? { label: "Win", tone: "success" as const }
      : encounter.aGoals < encounter.bGoals
        ? { label: "Loss", tone: "danger" as const }
        : { label: "Draw", tone: "neutral" as const };

  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tournaments/${encounter.tournamentSlug}`}
            className="block truncate text-sm font-semibold text-grey-100 underline-offset-4 hover:underline"
          >
            {encounter.tournamentName}
          </Link>
          <p className="mt-0.5 text-xs text-grey-500">
            {STAGE_LABELS[encounter.stage] ?? encounter.stage}
            {encounter.playedAt ? ` · ${formatDate(encounter.playedAt)}` : ""} ·{" "}
            {encounter.aHome ? "you at home" : "you away"}
          </p>
        </div>
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
        <p className="font-display text-lg font-semibold tabular-nums text-white">
          {encounter.aGoals}–{encounter.bGoals}
        </p>
      </div>
    </li>
  );
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const aTag = firstQueryValue(params.a);
  const bTag = firstQueryValue(params.b);
  const page = Math.max(1, Number.parseInt(firstQueryValue(params.page) ?? "1", 10) || 1);
  const [aPlayer, bPlayer] = await Promise.all([
    aTag ? getPublicPlayerByGamerTag(aTag) : null,
    bTag ? getPublicPlayerByGamerTag(bTag) : null,
  ]);
  const a = usablePlayer(aPlayer, aTag);
  const b = usablePlayer(bPlayer, bTag);
  const samePlayer = Boolean(a && b && a.uid === b.uid);
  const both = Boolean(a && b && !samePlayer);
  const result = both && a && b ? await getHeadToHead(a.uid, b.uid, { page, pageSize: 10 }) : null;

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Players"
            title="Head-to-head"
            description="Two players, every recorded meeting. Totals cover completed matches only and are recalculated from the stored results."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Players", href: "/players" },
              { label: "Compare" },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-8 sm:py-12">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Choose two players</CardTitle>
              <p className="mt-1 text-xs leading-5 text-grey-400">
                Type a gamer tag and pick the real public profile. You can also submit the exact
                tag.
              </p>
            </CardHeader>
            <CardContent>
              <form method="get" action="/players/compare" className="grid gap-4 sm:grid-cols-2">
                <PlayerPicker name="a" label="Player A" initialTag={aTag} />
                <PlayerPicker name="b" label="Player B" initialTag={bTag} />
                <div className="sm:col-span-2">
                  <button type="submit" className={buttonStyles({ size: "sm" })}>
                    <Swords aria-hidden="true" className="h-4 w-4" />
                    Compare
                  </button>
                </div>
              </form>

              {aTag && !a ? (
                <p className="mt-4 text-sm text-warning-soft">
                  No active public profile matches <span className="font-semibold">@{aTag}</span>.
                </p>
              ) : null}
              {bTag && !b ? (
                <p className="mt-4 text-sm text-warning-soft">
                  No active public profile matches <span className="font-semibold">@{bTag}</span>.
                </p>
              ) : null}
              {samePlayer ? (
                <p className="mt-4 text-sm text-warning-soft">
                  Choose two different players to compare.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          {!a || !b || !result ? (
            <EmptyState
              icon={Swords}
              eyebrow="Head-to-head"
              title="Pick two players to see their record"
              description="The comparison lists only matches recorded by a tournament admin in competitions whose fixtures are public."
            />
          ) : result.total === 0 ? (
            <EmptyState
              icon={Swords}
              eyebrow="No meetings"
              title="These players have not met yet"
              description={`@${a.profile.gamerTag} and @${b.profile.gamerTag} have no completed match together in a public tournament. Nothing is inferred from ranking or form.`}
            />
          ) : (
            <div className="space-y-6">
              <Card variant="elevated">
                <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/players/${encodeURIComponent(a.profile.gamerTag)}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <Avatar
                      name={a.profile.gamerTag}
                      src={a.profile.avatarUrl}
                      size="lg"
                      crossOrigin="anonymous"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-xl font-semibold uppercase tracking-display text-white">
                        @{a.profile.gamerTag}
                      </span>
                      <span className="block text-xs text-grey-500">
                        {getGame(a.profile.preferredGame).name}
                      </span>
                    </span>
                  </Link>

                  <div className="text-center">
                    <p className="font-display text-4xl font-semibold tabular-nums text-white">
                      {result.totals.aWins}–{result.totals.bWins}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                      {result.totals.draws} drawn · {result.totals.aGoals}–{result.totals.bGoals}{" "}
                      goals
                    </p>
                    <p className="mt-1 text-xs text-grey-500">
                      {result.total} {result.total === 1 ? "meeting" : "meetings"} recorded
                    </p>
                  </div>

                  <Link
                    href={`/players/${encodeURIComponent(b.profile.gamerTag)}`}
                    className="flex min-w-0 flex-row-reverse items-center gap-3 sm:text-right"
                  >
                    <Avatar
                      name={b.profile.gamerTag}
                      src={b.profile.avatarUrl}
                      size="lg"
                      crossOrigin="anonymous"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-xl font-semibold uppercase tracking-display text-white">
                        @{b.profile.gamerTag}
                      </span>
                      <span className="block text-xs text-grey-500">
                        {getGame(b.profile.preferredGame).name}
                      </span>
                    </span>
                  </Link>
                </CardContent>
              </Card>

              {result.mostRecent ? (
                <Card variant="gold">
                  <CardHeader>
                    <CardTitle className="text-lg">Most recent meeting</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EncounterRow encounter={result.mostRecent} />
                  </CardContent>
                </Card>
              ) : null}

              <div>
                <SectionHeading
                  title="Every encounter"
                  description="Newest recorded first. Each row links to the tournament."
                />
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-navy-900/50">
                  <ul className="divide-y divide-white/10">
                    {result.encounters.map((encounter) => (
                      <EncounterRow
                        key={`${encounter.tournamentId}-${encounter.matchId}`}
                        encounter={encounter}
                      />
                    ))}
                  </ul>
                </div>

                <Pagination
                  page={result.page}
                  pageCount={Math.max(1, Math.ceil(result.total / result.pageSize))}
                  hrefForPage={(target) =>
                    compareHref({
                      a: a.profile.gamerTag,
                      b: b.profile.gamerTag,
                      page: target,
                    })
                  }
                  ariaLabel="Head-to-head encounters"
                  className="mt-4"
                />

                {result.scanned >= 500 ? (
                  <p className="mt-3 text-xs leading-5 text-grey-500">
                    Encounters come from the most recent 500 completed matches for this player.
                    Older meetings outside that window are not included.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rankings"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  <Trophy aria-hidden="true" className="h-4 w-4" />
                  View rankings
                </Link>
                <Link href="/players" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Search players
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
