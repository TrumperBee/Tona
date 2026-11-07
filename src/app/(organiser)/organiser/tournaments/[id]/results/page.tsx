// GCC - Results.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { ClipboardList } from "lucide-react";

export const metadata = { title: "Results" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Results"
      description={
        <>
          Record verified scores and confirm the outcomes that update the league table. This
          workspace is scoped to tournament <span className="font-mono text-grey-200">{id}</span>.
          Every action applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Results" },
      ]}
      availabilityTitle="No results recorded yet"
      availabilityDescription="Only confirmed matches will appear here. A score entered by a participant is not final until it passes the review process."
      icon={ClipboardList}
    />
  );
}
