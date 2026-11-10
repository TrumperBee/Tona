// GCC - Graphics.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Image as ImageIcon } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Graphics" };

export default function GraphicsPage() {
  return (
    <WorkspaceToolNotice
      icon={ImageIcon}
      title="Graphics"
      description="Generate competition graphics from the same standings and fixture data used by the platform. Every action here applies to this competition only."
      availabilityTitle="Graphic generation is not open yet"
      availabilityDescription="Graphics arrive once standings and fixtures exist. Nothing is rendered from sample data, so there is nothing to show here until the real competition data exists."
    />
  );
}
