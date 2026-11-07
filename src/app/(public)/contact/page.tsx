// GCC - contact page.
//
// Contact channels are environment-driven. When they are not configured the
// page says so plainly rather than inventing an address or rendering a form
// that cannot deliver a message.
import {
  ArrowUpRight,
  Check,
  ClipboardList,
  Mail,
  MessageCircle,
  ShieldAlert,
  ShoppingBag,
  Trophy,
  UserCog,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { siteConfig } from "@/lib/config/site";

export const metadata = {
  title: "Contact",
  description:
    "Contact the GCC team about competitions, organiser applications, privacy requests or the platform.",
};

const topics = [
  {
    title: "Competitions and results",
    description:
      "Questions about a published tournament, a fixture or a recorded result. Once competitions are live, result challenges must be raised through the dispute process so they carry an audit trail.",
    icon: Trophy,
  },
  {
    title: "Organiser applications",
    description:
      "Questions about running a competition on GCC, the review process or the responsibilities of an approved organiser.",
    icon: UserCog,
  },
  {
    title: "Privacy and account data",
    description:
      "Requests to access, correct or remove personal data, or questions about how competition records are retained.",
    icon: ShieldAlert,
  },
  {
    title: "Marketplace",
    description:
      "eHubMarket is an independent partner. Account purchases, deliveries and refunds are handled by eHubMarket, not by GCC.",
    icon: ShoppingBag,
  },
] as const;

export default function ContactPage() {
  const hasChannel = Boolean(siteConfig.contactEmail || siteConfig.contactWhatsAppUrl);
  const channelCount =
    Number(Boolean(siteConfig.contactEmail)) + Number(Boolean(siteConfig.contactWhatsAppUrl));

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Contact"
            title="Talk to the team"
            description="Use the channel below for platform questions. Please do not send passwords, one-time codes or payment details by email or chat."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          {hasChannel ? (
            <div className="grid gap-4 md:grid-cols-2">
              {siteConfig.contactEmail ? (
                <Card variant="elevated" className="p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-electric-400/25 bg-electric-500/10 text-electric-300">
                    <Mail aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 font-display text-2xl font-semibold uppercase tracking-display text-white">
                    Email
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-grey-400">
                    The best channel for account, privacy and organiser questions.
                  </p>
                  <a
                    href={`mailto:${siteConfig.contactEmail}`}
                    className={buttonStyles({
                      variant: "secondary",
                      size: "sm",
                      className: "mt-5",
                    })}
                  >
                    {siteConfig.contactEmail}
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </Card>
              ) : null}

              {siteConfig.contactWhatsAppUrl ? (
                <Card variant="elevated" className="p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-success/30 bg-success/10 text-success-soft">
                    <MessageCircle aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 font-display text-2xl font-semibold uppercase tracking-display text-white">
                    WhatsApp
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-grey-400">
                    Short operational questions. Opens in a new tab.
                  </p>
                  <a
                    href={siteConfig.contactWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonStyles({
                      variant: "secondary",
                      size: "sm",
                      className: "mt-5",
                    })}
                  >
                    Open WhatsApp
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </Card>
              ) : null}

              {channelCount === 1 ? (
                <Card variant="elevated" className="p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-gold-400/30 bg-gold-400/10 text-gold-300">
                    <ClipboardList aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 font-display text-2xl font-semibold uppercase tracking-display text-white">
                    Before you write
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-grey-400">
                    A little context helps the team answer faster.
                  </p>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-grey-300">
                    {[
                      "Include your gamer tag, the game and the competition name.",
                      "Raise result challenges through the dispute process, not chat.",
                      "Never send passwords, one-time codes or payment details.",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check
                          aria-hidden="true"
                          className="mt-1 h-4 w-4 shrink-0 text-electric-300"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={Mail}
              eyebrow="Not configured"
              title="Public contact channels are not published yet"
              description={
                <>
                  GCC has not published an email address or WhatsApp number for this deployment. No
                  contact form is shown because there is no delivery service behind it, and no
                  address has been invented to fill the gap.
                </>
              }
              action={
                <Link href="/about" className={buttonStyles({ size: "sm" })}>
                  Read about GCC
                </Link>
              }
              secondaryAction={
                <Link
                  href="/tournaments"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Browse tournaments
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section>
        <div className="container py-12 sm:py-16">
          <h2 className="font-display text-3xl font-semibold uppercase tracking-display text-white">
            What to ask about
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {topics.map((topic) => {
              const Icon = topic.icon;

              return (
                <Card key={topic.title}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-electric-300">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-lg">{topic.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-grey-400">{topic.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 max-w-2xl text-xs leading-5 text-grey-500">
            Marketplace purchases are between you and eHubMarket. GCC does not receive your payment
            details and cannot refund, replace or recover an account bought from a third party.
          </p>
        </div>
      </section>
    </>
  );
}
