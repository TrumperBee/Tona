// GCC - Super Admin overview.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { LayoutDashboard } from "lucide-react";

export const metadata = { title: "Super Admin overview" };

export default function SuperAdminPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Super Admin overview"
      description="Platform health, review queues and privileged actions in one place."
      availabilityTitle="No platform data to show yet"
      availabilityDescription="Operational metrics appear here only when the platform has real accounts, tournaments and review queues. Every number will come from server-side records."
      icon={LayoutDashboard}
      note="This console is restricted to the configured Super Admin account and is guarded on the server before it renders."
    />
  );
}
