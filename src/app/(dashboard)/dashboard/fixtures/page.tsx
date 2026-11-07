// GCC - My fixtures.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "My fixtures" };

export default function FixturesPage() {
  return (
    <FeatureNotice
      eyebrow="Player dashboard"
      title="My fixtures"
      description="Your matches, deadlines and result status across every competition you enter."
      availabilityTitle="No fixtures scheduled"
      availabilityDescription="Fixtures appear after an organiser confirms the field, completes the draw and publishes the schedule. No match is invented here."
      icon={CalendarDays}
      action={
        <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
          Browse tournaments
        </Link>
      }
    />
  );
}
