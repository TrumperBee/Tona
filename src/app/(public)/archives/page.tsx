// GCC - archives.
// Completed seasons are preserved. Until a season exists, the archive is empty.
import { ArrowRight, Archive, CalendarDays, History, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

export const metadata = {
  title: "Archives",
  description:
    "Preserved GCC seasons with final standings, knockout results and champions. Nothing is fabricated before a season is complete.",
};

const preserved = [
  {
    title: "Final standings",
    description:
      "The league-phase table as it stood after the last verified matchday, with qualification bands intact.",
    icon: Trophy,
  },
  {
    title: "Every knockout tie",
    description:
      "Play-off and knockout results, including the aggregate score and the team that advanced.",
    icon: CalendarDays,
  },
  {
    title: "Season context",
    description:
      "Format version, participating field, rules snapshot and the competition dates that applied.",
    icon: History,
  },
] as const;

export default function ArchivesPage() {
  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Archives"
            description="A competition platform is only as good as its memory. Completed GCC seasons are preserved here with their tables, knockout results and champion."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Archives" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <EmptyState
            size="lg"
            icon={Archive}
            eyebrow="No archived seasons"
            title="There is no season to revisit yet"
            description="No GCC competition has been completed. When a season ends, its final record moves here automatically; archives are not assembled by hand or filled with sample results."
            action={
              <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                Browse tournaments
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
            secondaryAction={
              <Link
                href="/hall-of-fame"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Hall of Fame
              </Link>
            }
          />
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <h2 className="font-display text-3xl font-semibold uppercase tracking-display text-white">
            What a preserved season includes
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {preserved.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="h-full p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold uppercase tracking-display text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-grey-400">{item.description}</p>
                </Card>
              );
            })}
          </div>

          <Card variant="gold" className="mt-6 p-6">
            <CardHeader className="border-0 p-0">
              <CardTitle className="text-lg">Records survive rule changes</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <p className="text-sm leading-7 text-grey-300">
                A season is stored with the format and rules version that applied when it was
                played. If the platform adds another format later, an archived season still reads
                correctly instead of being reinterpreted under new rules.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
