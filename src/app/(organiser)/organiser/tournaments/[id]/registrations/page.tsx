// GCC - Registrations.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Users } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Registrations" };

export default function RegistrationsPage() {
  return (
    <WorkspaceToolNotice
      icon={Users}
      title="Registrations"
      description="Review entries, confirm the field and track withdrawals for this competition. Every action here applies to this competition only."
      availabilityTitle="Registration management opens with the organiser tools"
      availabilityDescription="Confirming the field, approving entries and recording withdrawals are privileged actions. Each one is written by the server and recorded in the audit history; the entrant count in the header above is already live from the competition document."
    />
  );
}
