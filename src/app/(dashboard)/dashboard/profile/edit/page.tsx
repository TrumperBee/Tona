// GCC - edit profile page.
import { UserRound } from "lucide-react";
import Link from "next/link";

import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { getOwnProfile } from "@/lib/profile/server";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requirePageSignedIn("/dashboard/profile/edit");
  const profile = await getOwnProfile(user.userId);

  if (!profile) {
    return (
      <EmptyState
        icon={UserRound}
        eyebrow="Profile"
        title="Your profile document is missing"
        description="Your sign-in works, but the server could not find your player profile. Contact the GCC team so the account can be repaired."
        action={
          <Link href="/contact" className={buttonStyles({ size: "sm" })}>
            Contact the team
          </Link>
        }
      />
    );
  }

  const { user: privateProfile } = profile;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Player profile"
        title="Edit profile"
        description="Update your display details and private contact number. Changes are saved to your private and public profiles in one transaction."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Profile", href: "/dashboard/profile" },
          { label: "Edit" },
        ]}
      />

      <ProfileForm
        gamerTag={privateProfile.gamerTag}
        avatarUrl={privateProfile.avatarUrl}
        initial={{
          fullName: privateProfile.fullName,
          community: privateProfile.community,
          favouriteClub: privateProfile.favouriteClub,
          whatsappE164: privateProfile.whatsappE164,
          country: privateProfile.country,
          preferredGame: privateProfile.preferredGame,
          platform: privateProfile.platform,
        }}
      />
    </div>
  );
}
