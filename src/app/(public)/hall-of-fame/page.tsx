// GCC - Hall of Fame.
// Champions are recorded from completed finals. Until then, no entry is shown.
import { ArrowRight, Award, History, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

export const metadata = {
  title: "Hall of Fame",
  description:
    "The permanent record of GCC champions. No entry exists until a final is complete and verified.",
};

const criteria = [
  {
    title: "A completed final",
    description:
      "The final must be recorded and confirmed in the platform. A semi-final lead, a walkover rumour or a chat screenshot is not a title.",
    icon: Trophy,
  },
  {
    title: "A verified champion",
    description:
      "The winner is taken from the verified knockout record, together with the season, tournament and runner-up.",
    icon: Award,
  },
  {
    title: "A permanent entry",
    description:
      "Hall of Fame entries are never hard-deleted. A correction creates a new audited state rather than erasing the original.",
    icon: History,
  },
] as const;

export default function HallOfFamePage() {
  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Hall of Fame"
            description="The names that survive the season. Every entry is earned by a verified final, recorded by the platform and preserved permanently."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hall of Fame" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <EmptyState
            size="lg"
            icon={Trophy}
            eyebrow="No champions yet"
            title="The first final has not been played"
            description="No GCC competition has reached a verified final, so the Hall of Fame is empty. There are no honorary entries, sample champions or placeholders."
            action={
              <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                See the competitions
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
            secondaryAction={
              <Link href="/archives" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Visit the archives
              </Link>
            }
          />
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <h2 className="font-display text-3xl font-semibold uppercase tracking-display text-white">
            How induction works
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {criteria.map((criterion) => {
              const Icon = criterion.icon;

              return (
                <Card key={criterion.title} className="h-full p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-gold-400/25 bg-gold-400/10 text-gold-300">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold uppercase tracking-display text-white">
                    {criterion.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-grey-400">{criterion.description}</p>
                </Card>
              );
            })}
          </div>

          <Card variant="outline" className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">What an entry will show</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-grey-400">
                Season, tournament, champion, runner-up, final result and the date the title was
                confirmed. The player profile links to the same permanent competition record, so a
                career can be followed across seasons without a separate history being maintained by
                hand.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
