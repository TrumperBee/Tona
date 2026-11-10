// GCC - Fixtures.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { CalendarDays } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Fixtures" };

export default function FixturesPage() {
  return (
    <WorkspaceToolNotice
      icon={CalendarDays}
      title="Fixtures"
      description="Generate and publish the eight-matchday league phase for this tournament. Every action here applies to this competition only."
      availabilityTitle="Fixture generation is not open yet"
      availabilityDescription="The schedule is generated from the confirmed pots, and publishing it moves the competition to the league phase — a recorded status change, never a silent edit."
    />
  );
}
