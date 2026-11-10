// GCC - organiser code of conduct.
//
// A public, permanent reference linked from the application form. It states the
// standards GCC expects from organisers without making promises the platform
// does not keep.
import { CalendarCheck, Handshake, Lock, ShieldCheck, Swords, Wallet } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Organiser code",
  description:
    "The fair-play, results, privacy and payment standards every GCC organiser agrees to.",
};

const commitments = [
  {
    id: "fair-play",
    icon: Swords,
    title: "Run a fair competition",
    body: (
      <>
        <p>
          Publish the rules before registration opens and apply them equally to every player. Do not
          change a rule mid-competition to favour a participant, and do not give anyone a place,
          seeding or scheduling advantage that the published rules do not allow.
        </p>
        <p>
          Refuse entries that do not meet the published requirements. If you must remove a player,
          record the reason and tell them directly so the decision can be reviewed.
        </p>
      </>
    ),
  },
  {
    id: "results",
    icon: CalendarCheck,
    title: "Record accurate results",
    body: (
      <>
        <p>
          Enter the final score that both players agree was played. Never invent, alter or delete a
          result to change a table, qualification place or prize outcome. The server record is
          authoritative; screenshots and chat messages do not replace it.
        </p>
        <p>
          If a result is disputed, use the platform&rsquo;s result-report channel for admin review.
          A correction is made by the tournament owner or Super Admin with a reason and an audit
          entry, so history is preserved rather than rewritten.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    icon: Lock,
    title: "Respect players' privacy",
    body: (
      <>
        <p>
          Contact details are shared with you only so you can run the competition. Do not publish,
          sell, scrape or reuse a player&rsquo;s email address, WhatsApp number or other private
          data. Do not add players to unrelated groups or marketing lists.
        </p>
        <p>
          Use platform tools for communication where they exist. Share only the minimum information
          another player needs to take part, and remove access when a competition ends.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    icon: Handshake,
    title: "Treat players with respect",
    body: (
      <>
        <p>
          Harassment, threats, discrimination and retaliation have no place in a GCC competition.
          Moderate your community consistently, and do not use your organiser role to intimidate or
          silence a participant.
        </p>
        <p>
          You are an independent community operator, not a GCC employee or agent. Do not claim to
          speak for GCC or make promises on its behalf.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    icon: Wallet,
    title: "Payments are not handled by GCC",
    body: (
      <>
        <p>
          GCC does not collect, hold, process or refund entry fees, prizes or any other payment for
          a tournament. If your community chooses to charge a fee outside GCC, that arrangement is
          entirely between you and the players involved.
        </p>
        <p>
          State any costs clearly before a player enters, keep your own records, and never describe
          a payment as being protected by GCC. GCC cannot mediate a payment dispute and will not ask
          players to send money on an organiser&rsquo;s behalf.
        </p>
      </>
    ),
  },
] as const;

export default function OrganiserCodePage() {
  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Organisers"
        title="Organiser code of conduct"
        description="Every organiser agrees to these standards before the role is granted. They exist to protect players, keep results trustworthy and make competitions worth entering."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Organiser code" }]}
        actions={
          <Link href="/dashboard/apply-admin" className={buttonStyles({ size: "sm" })}>
            Apply to organise
          </Link>
        }
      />

      <div className="mt-10 grid gap-6">
        {commitments.map((commitment) => {
          const Icon = commitment.icon;

          return (
            <Card
              key={commitment.id}
              variant="elevated"
              className="scroll-mt-24"
              id={commitment.id}
            >
              <CardHeader className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gold-400/25 bg-gold-400/10 text-gold-300">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <CardTitle>{commitment.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-grey-300">
                {commitment.body}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card variant="gold" className="mt-8">
        <CardContent className="flex items-start gap-4 p-6">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-gold-300" />
          <div>
            <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
              What happens if the code is broken
            </h2>
            <p className="mt-2 text-sm leading-6 text-grey-300">
              A breach can result in a warning, removal of the organiser role, or account
              suspension. Serious cases may be reported to the relevant game or community operator.
              The Super Admin records the reason and the application history is kept.
            </p>
            <p className="mt-3 text-sm leading-6 text-grey-400">
              Questions about the code can be raised through the{" "}
              <Link href="/contact" className="font-semibold text-electric-300 hover:underline">
                contact page
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
