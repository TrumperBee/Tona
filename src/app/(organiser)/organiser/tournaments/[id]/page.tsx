// GCC - Manage tournament.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { LayoutDashboard } from "lucide-react";

export const metadata = { title: "Manage tournament" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IdPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Manage tournament"
      description={
        <>
          This is the operations hub for this competition. Every tool in the sidebar acts on this
          tournament only. This workspace is scoped to tournament{" "}
          <span className="font-mono text-grey-200">{id}</span>. Every action applies to this
          competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Overview" },
      ]}
      availabilityTitle="Tournament management is not available yet"
      availabilityDescription="Registrations, pots, fixtures, results, result reports, announcements and settings will be managed from this workspace when the competition engine opens."
      icon={LayoutDashboard}
    />
  );
}
