// GCC - Analytics.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { BarChart3 } from "lucide-react";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Analytics"
      description="Verified platform metrics for competitions, participation and retention."
      availabilityTitle="No verified metrics yet"
      availabilityDescription="Charts will be generated from real records. Until there are records, this page reports nothing rather than displaying fabricated numbers."
      icon={BarChart3}
    />
  );
}
