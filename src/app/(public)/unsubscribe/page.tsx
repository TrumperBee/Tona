// GCC - unsubscribe confirmation page.
//
// A GET request only verifies the signed token and shows what would change. The
// preference is written only after the POST from the confirmation button, which
// keeps link scanners and prefetchers from unsubscribing anyone.
import Link from "next/link";

import { UnsubscribeForm } from "@/components/email/unsubscribe-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getEmailConfig } from "@/lib/email/config";
import { verifyUnsubscribeToken } from "@/lib/email/tokens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

interface UnsubscribePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const raw = typeof params.t === "string" ? params.t : "";
  const token = verifyUnsubscribeToken(getEmailConfig().unsubscribeSecret, raw);

  return (
    <div className="container py-12 sm:py-16">
      <PageHeader
        eyebrow="Email preferences"
        title="Unsubscribe"
        description="Change one email stream without signing in."
      />

      <Card className="mt-8 max-w-2xl">
        <CardContent className="pt-5">
          {token ? (
            <UnsubscribeForm token={raw} category={token.category} />
          ) : (
            <div className="space-y-4 text-sm leading-7 text-grey-300">
              <p className="font-semibold text-white">This link is invalid or has expired.</p>
              <p>
                Unsubscribe links expire after 60 days. Sign in and change your email preferences in
                settings, or request a new link from any recent email.
              </p>
              <Link
                href="/dashboard/notifications/settings"
                className="inline-flex rounded text-electric-300 underline underline-offset-4 hover:text-electric-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
              >
                Open notification settings
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
