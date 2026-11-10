// GCC - Pots and draw.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { CircleDot } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Pots and draw" };

export default function PotsPage() {
  return (
    <WorkspaceToolNotice
      icon={CircleDot}
      title="Pots and draw"
      description="Place the confirmed field into four pots of nine and record the draw for the league phase. Every action here applies to this competition only."
      availabilityTitle="The draw is not recorded yet"
      availabilityDescription="Pots are confirmed only after registration closes. Whether the draw is manual or a seeded shuffle, the operator and method are recorded so the draw can always be verified afterwards."
    />
  );
}
