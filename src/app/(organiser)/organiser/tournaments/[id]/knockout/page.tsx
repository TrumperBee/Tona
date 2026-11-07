// GCC - Knockout.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Swords } from "lucide-react";

export const metadata = { title: "Knockout" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KnockoutPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Knockout"
      description={
        <>
          Advance qualifiers into the play-offs and knockout rounds after the league phase. This
          workspace is scoped to tournament <span className="font-mono text-grey-200">{id}</span>.
          Every action applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Knockout" },
      ]}
      availabilityTitle="No knockout ties yet"
      availabilityDescription="Knockout ties are generated from final league positions, not selected by hand. The bracket opens after matchday 8 is verified."
      icon={Swords}
    />
  );
}
