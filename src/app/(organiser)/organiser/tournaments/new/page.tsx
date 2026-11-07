// GCC - New tournament.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "New tournament" };

export default function NewPage() {
  return (
    <FeatureNotice
      eyebrow="Organiser workspace"
      title="Create a tournament"
      description="Set the competition name, game, format, rules, dates and field size, then save a real draft."
      availabilityTitle="Tournament creation is not open yet"
      availabilityDescription="The creation flow opens with organiser tools. It will validate every field on the server and save a draft that only the owner can edit."
      icon={Plus}
      action={
        <Link href="/organiser/tournaments" className={buttonStyles({ size: "sm" })}>
          Back to my tournaments
        </Link>
      }
    />
  );
}
