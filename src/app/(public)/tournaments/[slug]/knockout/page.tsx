// GCC - public knockout bracket page.
//
// A dedicated address for the generated bracket, so it can be linked, printed
// and audited on its own. It reads the same stored ties as the Knockout tab on
// the tournament page and shows an honest empty state before generation.
import { ArrowLeft, Swords } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { PublicKnockoutPanel } from "@/components/tournament/public-knockout-panel";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/data-display";
import { getPublicKnockout } from "@/lib/data/public-knockout";
import { getPublicTournamentBySlug } from "@/lib/data/public-tournaments";

export const revalidate = 30;

interface KnockoutPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: KnockoutPageProps) {
  const { slug } = await params;
  const tournament = await getPublicTournamentBySlug(slug);

  return {
    title: tournament ? `${tournament.name} knockout` : "Knockout not found",
    description: tournament
      ? `The generated knockout bracket for ${tournament.name}, from the play-offs to the final.`
      : "Knockout bracket",
  };
}

export default async function PublicKnockoutPage({ params }: KnockoutPageProps) {
  const { slug } = await params;
  const tournament = await getPublicTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const knockout = await getPublicKnockout(tournament.id, tournament.status);

  if (!knockout) {
    return (
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow={tournament.name}
            title="Knockout bracket"
            description="The bracket appears the moment the organiser generates it, after every league result is recorded."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: tournament.name, href: `/tournaments/${tournament.slug}` },
              { label: "Knockout" },
            ]}
            actions={
              <Link
                href={`/tournaments/${tournament.slug}`}
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Tournament
              </Link>
            }
          />
          <div className="mt-8 max-w-xl">
            <EmptyState
              icon={Swords}
              eyebrow="Knockout bracket"
              title="The bracket has not been generated yet"
              description="The organiser generates all 23 ties in one step once all 144 league results are recorded. Nothing is filled in ahead of time."
              action={
                <Link
                  href={`/tournaments/${tournament.slug}`}
                  className={buttonStyles({ size: "sm" })}
                >
                  Open the tournament
                </Link>
              }
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-12">
          <PageHeader
            eyebrow={`${tournament.name} · ${tournament.season || "Season to be confirmed"}`}
            title="Knockout bracket"
            description="Every tie from the play-offs to the final, generated and advanced by the server from recorded results."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: tournament.name, href: `/tournaments/${tournament.slug}` },
              { label: "Knockout" },
            ]}
            actions={
              <Link
                href={`/tournaments/${tournament.slug}`}
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Tournament
              </Link>
            }
          />
        </div>
      </section>

      <PublicKnockoutPanel knockout={knockout} />
    </>
  );
}
