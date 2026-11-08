// GCC - Result reports.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Flag } from "lucide-react";

export const metadata = { title: "Result reports" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultReportsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Result reports"
      description={
        <>
          Review problems reported by players about a recorded result. A report is a request for
          admin review, not an official result change; any correction is made on the Results page
          with a reason and an audit entry. This workspace is scoped to tournament{" "}
          <span className="font-mono text-grey-200">{id}</span>.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Result reports" },
      ]}
      availabilityTitle="No result reports to review"
      availabilityDescription="A report appears only when a signed-in player raises one inside the platform. The reporter, the tournament owner and the Super Admin can read it; all writes remain server-only."
      icon={Flag}
    />
  );
}
