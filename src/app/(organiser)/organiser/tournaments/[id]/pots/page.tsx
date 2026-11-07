// GCC - Pots and draw.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { CircleDot } from "lucide-react";

export const metadata = { title: "Pots and draw" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PotsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Pots and draw"
      description={
        <>
          Place the confirmed field into four pots of nine and record the draw for the league phase.
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
        { label: "Pots and draw" },
      ]}
      availabilityTitle="The draw is not available yet"
      availabilityDescription="Pots cannot be confirmed until registration is live. The draw will be validated before any fixture can be generated."
      icon={CircleDot}
    />
  );
}
