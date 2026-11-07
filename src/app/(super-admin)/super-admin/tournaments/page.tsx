// GCC - All tournaments.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Trophy } from "lucide-react";

export const metadata = { title: "All tournaments" };

export default function TournamentsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="All tournaments"
      description="Oversee every competition on the platform and its current stage."
      availabilityTitle="No tournaments on the platform yet"
      availabilityDescription="This view will include published, suspended and archived competitions, with ownership and status visible."
      icon={Trophy}
    />
  );
}
