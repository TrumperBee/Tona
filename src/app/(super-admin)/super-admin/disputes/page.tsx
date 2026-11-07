// GCC - Disputes.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Gavel } from "lucide-react";

export const metadata = { title: "Disputes" };

export default function DisputesPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Disputes"
      description="Review escalated result disputes and organiser decisions."
      availabilityTitle="No disputes to review yet"
      availabilityDescription="Only disputes that need platform oversight will be escalated here. No sample case is shown."
      icon={Gavel}
    />
  );
}
