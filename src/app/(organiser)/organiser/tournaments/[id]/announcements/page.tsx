// GCC - Announcements.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Megaphone } from "lucide-react";

export const metadata = { title: "Announcements" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnnouncementsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <FeatureNotice
      eyebrow="Tournament workspace"
      title="Announcements"
      description={
        <>
          Publish operational updates to the participants in this competition. This workspace is
          scoped to tournament <span className="font-mono text-grey-200">{id}</span>. Every action
          applies to this competition only.
        </>
      }
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Organiser", href: "/organiser" },
        { label: "Tournaments", href: "/organiser/tournaments" },
        { label: id },
        { label: "Announcements" },
      ]}
      availabilityTitle="No announcements published"
      availabilityDescription="Announcements will be delivered to registered participants through the platform. No message is sent from this placeholder."
      icon={Megaphone}
    />
  );
}
