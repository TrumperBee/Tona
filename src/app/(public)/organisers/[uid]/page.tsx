// GCC - public organiser page.
//
// Real Firestore data only: the organiser's public profile plus the
// competitions they run that are visible to the public. Honest empty states;
// never a sample organisation or a sample competition.
import { Building2, CalendarClock, ExternalLink, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { getPublicTournamentsByOwner } from "@/lib/data/public-tournaments";
import { getOrganiserProfile } from "@/lib/organiser/profile";
import { formatDate } from "@/lib/utils/dates";

interface OrganiserPageProps {
  readonly params: Promise<{ uid: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function generateMetadata({ params }: OrganiserPageProps) {
  const { uid } = await params;
  const profile = await getOrganiserProfile(uid);

  return {
    title: profile ? profile.organisationName : "Organiser not found",
    description: profile?.bio
      ? profile.bio
      : profile
        ? `${profile.organisationName} competitions on GCC: formats, dates and registration information.`
        : undefined,
  };
}

export default async function OrganiserPage({ params, searchParams }: OrganiserPageProps) {
  const { uid } = await params;
  const query = await searchParams;
  const after = firstQueryValue(query.after);
  const profile = await getOrganiserProfile(uid);

  if (!profile || profile.organisationName.trim().length === 0) {
    notFound();
  }

  const page = await getPublicTournamentsByOwner(uid, after);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Organiser"
            title={profile.organisationName}
            description={
              profile.bio ??
              "This organiser has not published a description of their organisation yet."
            }
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: profile.organisationName },
            ]}
          />

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-navy-900 ring-2 ring-gold-400/60 ring-offset-4 ring-offset-navy-950">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={`${profile.organisationName} logo`}
                  className="h-full w-full object-contain p-1.5"
                />
              ) : (
                <Building2 aria-hidden="true" className="h-10 w-10 text-grey-500" />
              )}
            </span>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">
                  <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                  {profile.createdAt ? `On GCC since ${formatDate(profile.createdAt)}` : "On GCC"}
                </Badge>
              </div>
              {profile.links.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {profile.links.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-sm font-medium text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                      >
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                <span aria-hidden="true" className="h-px w-6 bg-gold-400/60" />
                Competitions
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold uppercase tracking-display text-white">
                Tournaments by {profile.organisationName}
              </h2>
            </div>
            <Link
              href="/tournaments"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              All tournaments
            </Link>
          </div>

          <div className="mt-8">
            {page.rows.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No public competitions yet"
                description={
                  <>
                    {profile.organisationName} has no competitions visible to the public yet. Drafts
                    and suspended competitions stay private to the organiser. When a competition
                    opens for registration, it appears here with its real dates and entry numbers.
                  </>
                }
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {page.rows.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </div>

          {after || (page.hasMore && page.lastId) ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {after ? (
                <Link
                  href={`/organisers/${uid}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Back to the latest competitions
                </Link>
              ) : null}
              {page.hasMore && page.lastId ? (
                <Link
                  href={`/organisers/${uid}?after=${page.lastId}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Show older competitions
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <p className="sr-only">{page.rows.length} public competitions shown for this organiser.</p>
    </>
  );
}
