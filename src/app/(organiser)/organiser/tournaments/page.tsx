// GCC - My tournaments.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { Trophy } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "My tournaments" };

export default function TournamentsPage() {
  return (
    <FeatureNotice
      eyebrow="Organiser workspace"
      title="My tournaments"
      description="Every competition you own, with its current stage and the next operational step."
      availabilityTitle="You do not own any tournaments yet"
      availabilityDescription="Created competitions appear here with their real status. This list is scoped to your account on the server; it never shows another organiser's events."
      icon={Trophy}
      action={
        <Link href="/organiser/tournaments/new" className={buttonStyles({ size: "sm" })}>
          Create a tournament
        </Link>
      }
    />
  );
}
