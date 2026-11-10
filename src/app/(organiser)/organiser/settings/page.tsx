// GCC - organiser profile settings.
//
// The public organiser profile is created idempotently here (prefilled from
// the approved application's community name) the first time an organiser
// arrives, then edited through the strict PATCH endpoint.
import { ExternalLink, User } from "lucide-react";
import Link from "next/link";

import { OrganiserProfileForm } from "@/components/organiser/organiser-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/page-access";
import { ensureOrganiserProfile } from "@/lib/organiser/profile";

export const metadata = { title: "Organiser profile" };

export default async function OrganiserSettingsPage() {
  const user = await requirePageRole("organiser", "/organiser/settings");
  // Best effort: if no honest initial name exists the form still collects
  // one on first save, which creates the public document.
  const profile = await ensureOrganiserProfile(user.userId).catch(() => null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organiser workspace"
        title="Organiser profile"
        description="The public identity shown on every competition you run: organisation name, logo, description and up to three links. Everything here is written by the server after strict validation."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Organiser", href: "/organiser" },
          { label: "Organiser profile" },
        ]}
      />

      {profile ? (
        <Card variant="outline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink aria-hidden="true" className="h-4 w-4 text-electric-300" />
              Your public page is live
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-grey-300">
              Players see this page as “{profile.organisationName}”. It lists every competition you
              run that is visible to the public.
            </p>
            <Link
              href={`/organisers/${user.userId}`}
              className="text-sm font-medium text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              View your public organiser page
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User aria-hidden="true" className="h-4 w-4 text-gold-300" />
              Your public page is not published yet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-grey-300">
              Save an organisation name below to publish your public page. Until then your
              competitions show no organiser attribution.
            </p>
          </CardContent>
        </Card>
      )}

      <OrganiserProfileForm
        profileExists={Boolean(profile)}
        initial={{
          organisationName: profile?.organisationName ?? "",
          bio: profile?.bio ?? null,
          links: profile?.links ?? [],
          logoUrl: profile?.logoUrl ?? null,
        }}
      />
    </div>
  );
}
