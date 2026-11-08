// GCC - Result reports.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Flag } from "lucide-react";

export const metadata = { title: "Result reports" };

export default function SuperAdminResultReportsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Result reports"
      description="Review result problems reported by players and the organiser responses. A report is a player-to-admin channel, never an official result workflow."
      availabilityTitle="No result reports to review yet"
      availabilityDescription="Only reports that need platform oversight will appear here. No sample case is shown."
      icon={Flag}
    />
  );
}
