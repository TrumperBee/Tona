// GCC - Knockout.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Swords } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Knockout" };

export default function KnockoutPage() {
  return (
    <WorkspaceToolNotice
      icon={Swords}
      title="Knockout"
      description="Advance qualifiers into the play-offs and knockout rounds after the league phase. Every action here applies to this competition only."
      availabilityTitle="The bracket is not built yet"
      availabilityDescription="Qualifiers advance only after every league-phase result is recorded. Each knockout tie and its outcome will be written by the server with an audit entry."
    />
  );
}
