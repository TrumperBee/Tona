// GCC - Profile.
// Honest Phase 3 state: real heading and guidance, no mock data or controls.
import { FeatureNotice } from "@/components/shared/feature-notice";
import { buttonStyles } from "@/components/ui/button-styles";
import { User } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <FeatureNotice
      eyebrow="Player dashboard"
      title="Profile settings"
      description="Your gamer tag, country, preferred game, platform and contact preferences will be managed here."
      availabilityTitle="Profile editing is not open yet"
      availabilityDescription="Sign-in and profile management are handled by the account system. Until accounts open, no profile form is shown and nothing is collected on this page."
      icon={User}
      action={
        <Link href="/privacy" className={buttonStyles({ size: "sm" })}>
          Read the privacy policy
        </Link>
      }
      secondaryAction={
        <Link href="/login" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          About GCC accounts
        </Link>
      }
    />
  );
}
