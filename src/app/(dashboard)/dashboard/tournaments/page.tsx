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
      eyebrow="Player dashboard"
      title="My tournaments"
      description="Every competition you enter, with its current stage and your next match."
      availabilityTitle="You have not entered a tournament"
      availabilityDescription="Entries will appear here only when the platform records a real registration. Until then, this list stays empty."
      icon={Trophy}
      action={
        <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
          Browse tournaments
        </Link>
      }
    />
  );
}
