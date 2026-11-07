// GCC - Tournament settings.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Settings } from "lucide-react";

export const metadata = { title: "Tournament settings" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Tournament settings"
      description={
        <>
          Manage the rules, dates, timezone and field size for this competition. This workspace is
          scoped to tournament <span className="font-mono text-grey-200">{id}</span>. Every action
          applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Settings" },
      ]}
      availabilityTitle="Settings are not editable yet"
      availabilityDescription="Settings will be editable only before the stage that depends on them. A change after publication is recorded in the audit log."
      icon={Settings}
    />
  );
}
