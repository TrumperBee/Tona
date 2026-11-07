// GCC - Apply as organiser.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { Shield } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Apply as organiser" };

export default function ApplyAdminPage() {
  return (
    <FeatureNotice
      eyebrow="Player dashboard"
      title="Apply to become an organiser"
      description="Organisers run competitions for their community. Every application is reviewed before the role is granted."
      availabilityTitle="Organiser applications are not open yet"
      availabilityDescription="The application form opens with accounts. Approval is never automatic, and an organiser can manage only the tournaments they own."
      icon={Shield}
      action={
        <Link href="/about" className={buttonStyles({ size: "sm" })}>
          About GCC
        </Link>
      }
      secondaryAction={
        <Link href="/terms" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          Read the terms
        </Link>
      }
    />
  );
}
