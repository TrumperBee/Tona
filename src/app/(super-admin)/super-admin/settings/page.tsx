// GCC - Platform settings.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Settings } from "lucide-react";

export const metadata = { title: "Platform settings" };

export default function SettingsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Platform settings"
      description="Configure platform-level rules and operational defaults."
      availabilityTitle="Platform settings are not editable yet"
      availabilityDescription="Sensitive settings will be editable only by the Super Admin, and every change will be audited."
      icon={Settings}
    />
  );
}
