// GCC - Result reports.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Flag } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Result reports" };

export default function ResultReportsPage() {
  return (
    <WorkspaceToolNotice
      icon={Flag}
      title="Result reports"
      description="Review problems reported by players about a recorded result. A report is a request for admin review, not an official result change; any correction is made on the Results page with a reason and an audit entry."
      availabilityTitle="No results can be reported yet"
      availabilityDescription="Reports become possible once results are recorded. Until then this page stays empty by design — no sample reports are ever shown."
    />
  );
}
