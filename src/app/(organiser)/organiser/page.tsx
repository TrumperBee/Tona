// GCC - Organiser dashboard.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Organiser dashboard" };

export default function OrganiserPage() {
  return (
    <FeatureNotice
      eyebrow="Organiser workspace"
      title="Organiser dashboard"
      description="The operational home for the competitions you own: entries, draw, fixtures, results and records."
      availabilityTitle="No tournaments to manage yet"
      availabilityDescription="Once a tournament is created, its registrations, draw, fixtures and results are managed from this workspace."
      icon={LayoutDashboard}
      action={
        <Link href="/organiser/tournaments" className={buttonStyles({ size: "sm" })}>
          Open your tournament list
        </Link>
      }
    />
  );
}
