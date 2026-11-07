// GCC - player profile route.
//
// The route is real, but profiles are not public yet. The page never asserts
// that a gamer tag exists or does not exist; it explains the current state.
import { ArrowLeft, UserRound } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/data-display";

interface PlayerPageProps {
  params: Promise<{ gamerTag: string }>;
}

function decodeGamerTag(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({ params }: PlayerPageProps) {
  const { gamerTag } = await params;
  const name = decodeGamerTag(gamerTag);

  return {
    title: `${name} - Player profile`,
    description: `Public GCC player profile for ${name}.`,
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { gamerTag } = await params;
  const name = decodeGamerTag(gamerTag);

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Player profile"
        title={name}
        description="A GCC player profile will show this gamer tag's public identity and verified competitive record."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Players", href: "/players" },
          { label: name },
        ]}
        actions={
          <Link href="/players" className={buttonStyles({ variant: "secondary", size: "md" })}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to players
          </Link>
        }
      />

      <EmptyState
        className="mt-8"
        size="lg"
        icon={UserRound}
        eyebrow="Profiles not public yet"
        title="This public profile is not available yet"
        description={
          <>
            Player profiles open with public accounts and verified competition records. This page
            does not confirm or deny that the gamer tag is registered, and it does not display
            private account data.
          </>
        }
        action={
          <Link href="/players" className={buttonStyles({ size: "sm" })}>
            About the player directory
          </Link>
        }
        secondaryAction={
          <Link href="/privacy" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            What is public
          </Link>
        }
      />
    </div>
  );
}
