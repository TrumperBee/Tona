// GCC - public player directory.
// Profiles are not public yet; the page explains the model without inventing
// players or counts.
import { ArrowRight, Globe2, Lock, UserRound, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

export const metadata = {
  title: "Players",
  description:
    "The GCC player directory. Public profiles show a gamer tag, country and verified competitive record; contact details stay private.",
};

const profileFields = [
  { label: "Gamer tag", public: true },
  { label: "Country", public: true },
  { label: "Preferred game and platform", public: true },
  { label: "Tournaments, matches, wins, goals, titles", public: true },
  { label: "Email address", public: false },
  { label: "WhatsApp number", public: false },
] as const;

export default function PlayersPage() {
  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Community"
            title="Players"
            description="One identity across every competition. The public directory will show gamer tags, countries and verified competitive records — never email addresses or phone numbers."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Players" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <EmptyState
            size="lg"
            icon={Users}
            eyebrow="Profiles are private for now"
            title="The public player directory is not open yet"
            description="Accounts are not live, so there are no public profiles to list. When the directory opens, it will be built from real accounts and verified records — not seeded with example players."
            action={
              <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                Browse tournaments
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
            secondaryAction={
              <Link href="/about" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                About GCC
              </Link>
            }
          />
        </div>
      </section>

      <section>
        <div className="container grid gap-6 py-10 sm:py-14 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                  <UserRound aria-hidden="true" className="h-5 w-5" />
                </span>
                <CardTitle>What a profile will show</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                {profileFields.map((field) => (
                  <div
                    key={field.label}
                    className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0"
                  >
                    <dt className="text-sm text-grey-300">{field.label}</dt>
                    <dd>
                      <span
                        className={
                          field.public
                            ? "inline-flex items-center gap-1.5 text-xs font-semibold text-electric-300"
                            : "inline-flex items-center gap-1.5 text-xs font-semibold text-grey-500"
                        }
                      >
                        {field.public ? (
                          <Globe2 aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {field.public ? "Public" : "Private"}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card variant="outline">
            <CardHeader>
              <CardTitle>One identity, every season</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-grey-400">
              <p>
                A participant enters any number of competitions with the same account. The gamer tag
                is the identity opponents see, and the competitive record follows it across seasons.
              </p>
              <p>
                Data minimisation is deliberate: organisers receive only the contact details needed
                to run their competition, and those details never appear on a public page.
              </p>
              <Link
                href="/privacy"
                className="inline-flex items-center gap-1.5 font-semibold text-electric-300 underline-offset-4 hover:underline"
              >
                Read the privacy policy
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
