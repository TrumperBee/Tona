// GCC - Registrations.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Users } from "lucide-react";

export const metadata = { title: "Registrations" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RegistrationsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Registrations"
      description={
        <>
          Review entries, confirm the field and track withdrawals for this competition. This
          workspace is scoped to tournament <span className="font-mono text-grey-200">{id}</span>.
          Every action applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Registrations" },
      ]}
      availabilityTitle="No registrations to review yet"
      availabilityDescription="Entries will appear here only when the platform records a real registration. Placeholder players are never generated."
      icon={Users}
    />
  );
}
