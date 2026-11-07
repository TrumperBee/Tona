// GCC - Audit log.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Audit log"
      description="The history of privileged actions and corrections."
      availabilityTitle="No privileged actions recorded yet"
      availabilityDescription="Role changes, result corrections, suspensions and settings updates will be written here with the actor, time and reason."
      icon={ScrollText}
    />
  );
}
