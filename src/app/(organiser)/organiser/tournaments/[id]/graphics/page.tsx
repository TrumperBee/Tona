// GCC - Graphics.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Image as ImageIcon } from "lucide-react";

export const metadata = { title: "Graphics" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GraphicsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Graphics"
      description={
        <>
          Generate competition graphics from the same standings and fixture data used by the
          platform. This workspace is scoped to tournament{" "}
          <span className="font-mono text-grey-200">{id}</span>. Every action applies to this
          competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Graphics" },
      ]}
      availabilityTitle="Graphics generation is not available yet"
      availabilityDescription="Templates will be produced from verified tournament data, so an exported image can never disagree with the platform record."
      icon={ImageIcon}
    />
  );
}
