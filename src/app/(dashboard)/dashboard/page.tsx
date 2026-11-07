// GCC - Dashboard.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <FeatureNotice
      eyebrow="Player dashboard"
      title="Your dashboard"
      description="Your competitions, fixtures and next actions live here. Nothing appears until you enter a competition."
      availabilityTitle="No competitions on your account yet"
      availabilityDescription="When you enter a tournament, your next fixture and latest result will appear here. This dashboard does not display example data."
      icon={LayoutDashboard}
      action={
        <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
          Browse tournaments
        </Link>
      }
      secondaryAction={
        <Link
          href="/dashboard/apply-admin"
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          Apply as organiser
        </Link>
      }
    />
  );
}
