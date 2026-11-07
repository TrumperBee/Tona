// GCC - Applications.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { ClipboardList } from "lucide-react";

export const metadata = { title: "Applications" };

export default function ApplicationsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Admin applications"
      description="Review requests from players who want to organise competitions."
      availabilityTitle="No applications to review yet"
      availabilityDescription="Applications will appear here only when a real player submits one. Approval grants a role; it does not grant access to tournaments the organiser does not own."
      icon={ClipboardList}
    />
  );
}
