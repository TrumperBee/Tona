// GCC - Announcements.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Megaphone } from "lucide-react";

export const metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return (
    <FeatureNotice
      eyebrow="Super Admin console"
      title="Announcements"
      description="Send platform-wide communication to users and organisers."
      availabilityTitle="No announcements published yet"
      availabilityDescription="Announcements will be written and delivered by the server. No placeholder message is stored or sent."
      icon={Megaphone}
    />
  );
}
