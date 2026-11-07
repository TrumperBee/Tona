// GCC - Users.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Users } from "lucide-react";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Users"
      description="Review accounts, roles and account status across the platform."
      availabilityTitle="User administration is not available yet"
      availabilityDescription="Account search, role changes and suspensions are server-side actions. They will be recorded in the audit log with the acting account."
      icon={Users}
    />
  );
}
