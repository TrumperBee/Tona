// GCC - Announcements.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. Honest Phase 7 state: real explanation, no mock data or controls.
import { Megaphone } from "lucide-react";

import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";

export const metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return (
    <WorkspaceToolNotice
      icon={Megaphone}
      title="Announcements"
      description="Publish operational updates to the participants in this competition. Every action here applies to this competition only."
      availabilityTitle="Announcements are not publishable yet"
      availabilityDescription="Announcing arrives with the organiser tools. A published announcement is written by the server, delivered to participants and never editable after the fact."
    />
  );
}
