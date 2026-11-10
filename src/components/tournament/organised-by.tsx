// GCC - "Organised by" attribution for public tournament surfaces.
//
// Reads the organiser's public profile server-side and links to their public
// organiser page. When no profile exists yet the component renders nothing:
// no fake organisation names are ever shown.
import { Building2 } from "lucide-react";
import Link from "next/link";
import { cache } from "react";

import { getOrganiserProfile } from "@/lib/organiser/profile";

const loadOrganiser = cache(getOrganiserProfile);

export async function OrganisedBy({ ownerUid }: { readonly ownerUid: string }) {
  const profile = await loadOrganiser(ownerUid);

  if (!profile || profile.organisationName.trim().length === 0) {
    return null;
  }

  return (
    <p className="flex items-center gap-2 text-sm text-grey-400">
      <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-grey-500" />
      <span>Organised by</span>
      <Link
        href={`/organisers/${profile.uid}`}
        className="rounded font-medium text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
      >
        {profile.organisationName}
      </Link>
    </p>
  );
}
