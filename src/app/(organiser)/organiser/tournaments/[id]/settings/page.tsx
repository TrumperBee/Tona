// GCC - Tournament settings.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Settings } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Tournament settings" };

export default function SettingsPage() {
  return (
    <WorkspaceToolNotice
      icon={Settings}
      title="Tournament settings"
      description="Manage the rules, dates, timezone and field size for this competition. Every action here applies to this competition only."
      availabilityTitle="Settings are not editable yet"
      availabilityDescription="Settings will be editable only before the stage that depends on them. A change after publication is recorded in the audit log."
    />
  );
}
