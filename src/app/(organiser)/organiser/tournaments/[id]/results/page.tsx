// GCC - Results.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { ClipboardList } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Results" };

export default function ResultsPage() {
  return (
    <WorkspaceToolNotice
      icon={ClipboardList}
      title="Results"
      description="Record final scores as the tournament owner or Super Admin. A recorded result updates the league table immediately; corrections require a reason and are kept in the audit history."
      availabilityTitle="Result recording is not open yet"
      availabilityDescription="Score entry arrives with the organiser tools. Until then, no standings are published for this competition anywhere on the platform."
    />
  );
}
