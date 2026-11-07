// GCC - Disputes.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Gavel } from "lucide-react";

export const metadata = { title: "Disputes" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DisputesPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Disputes"
      description={
        <>
          Review result challenges with their evidence and record an auditable decision. This
          workspace is scoped to tournament <span className="font-mono text-grey-200">{id}</span>.
          Every action applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Disputes" },
      ]}
      availabilityTitle="No disputes to review"
      availabilityDescription="A dispute appears only when a participant raises one inside the platform. Decisions include a reason and are kept in the audit history."
      icon={Gavel}
    />
  );
}
