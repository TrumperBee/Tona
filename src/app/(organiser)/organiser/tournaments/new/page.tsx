// GCC - New tournament.
//
// The five-step creation wizard. Step 1 creates a real draft on the server
// (slot limits and slug reservations are enforced there); later steps patch
// it. Nothing fake is rendered — a slot-limited organiser sees the honest
// server error from the wizard's step 1 save.
import type { Metadata } from "next";

import { TournamentWizard } from "@/components/tournament/tournament-wizard";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageRole } from "@/lib/auth/page-access";

export const metadata: Metadata = {
  title: "Create a tournament",
  description:
    "Set up a GCC competition: basics, schedule, branding, rules and entry restrictions.",
};

export default async function NewTournamentPage() {
  await requirePageRole("organiser", "/organiser/tournaments/new");

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Organiser workspace"
            title="Create a tournament"
            description="Five steps create a draft you own: basics, schedule, branding, rules and entry restrictions, then a review that publishes it to players. Everything is validated again on the server — the format is the fixed 36-team league phase."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Organiser", href: "/organiser" },
              { label: "Tournaments", href: "/organiser/tournaments" },
              { label: "New" },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container max-w-3xl py-10 sm:py-14">
          <TournamentWizard />
        </div>
      </section>
    </>
  );
}
