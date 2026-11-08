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
          Record final scores as the tournament owner or Super Admin. A recorded result updates the
          league table immediately; corrections require a reason and are kept in the audit history.
          This workspace is scoped to tournament{" "}
          <span className="font-mono text-grey-200">{id}</span>. Every action applies to this
          competition only.
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
      availabilityDescription="Only matches with a result entered by the tournament owner or Super Admin appear here. Players never submit or confirm scores; they can report a problem for admin review."
      icon={ClipboardList}
    />
  );
}
