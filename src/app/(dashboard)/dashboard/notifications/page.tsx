// GCC - Notifications.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { Bell } from "lucide-react";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <FeatureNotice
      eyebrow="Player dashboard"
      title="Notifications"
      description="Competition updates, result confirmations and account notices are collected here."
      availabilityTitle="No notifications yet"
      availabilityDescription="The notification bell in the header points to this inbox. Messages will be created only by real platform events; nothing is seeded for display."
      icon={Bell}
    />
  );
}
