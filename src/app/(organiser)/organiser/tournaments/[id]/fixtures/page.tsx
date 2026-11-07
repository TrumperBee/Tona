// GCC - Fixtures.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "Fixtures" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FixturesPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Fixtures"
      description={
        <>
          Generate and publish the eight-matchday league phase for this tournament. This workspace
          is scoped to tournament <span className="font-mono text-grey-200">{id}</span>. Every
          action applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Fixtures" },
      ]}
      availabilityTitle="No fixtures generated yet"
      availabilityDescription="Fixture generation requires a confirmed draw. When it runs, the schedule is validated against every format constraint before publication."
      icon={CalendarDays}
    />
  );
}
