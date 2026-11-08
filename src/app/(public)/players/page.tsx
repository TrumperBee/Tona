// GCC - public player directory with real prefix search.
import { Globe2, Lock } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PlayerSearch } from "@/components/profile/player-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Players",
  description:
    "Search real GCC public profiles by gamer tag. Profiles show a tag, country, game and verified competitive record; contact details stay private.",
};

export default function PlayersPage() {
  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Community"
            title="Players"
            description="One identity across every competition. Search real gamer tags and open a public profile with its country, game and verified record."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Players" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container grid gap-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Find a player</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch />
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe2 aria-hidden="true" className="h-4 w-4 text-electric-300" />
                <CardTitle className="text-lg">Public by design</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-grey-400">
              <p>
                Public profiles show only a gamer tag, country, preferred game and platform,
                community, favourite club and verified match statistics.
              </p>
              <p className="flex items-start gap-2 text-grey-300">
                <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-grey-500" />
                Email addresses, WhatsApp numbers and account roles are never public.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
