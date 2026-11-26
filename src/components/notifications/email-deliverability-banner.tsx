// GCC - email deliverability notice.
//
// Shown in the dashboard when a hard bounce or a complaint marked the account
// email as undeliverable. The fix is a new address on the notification settings
// page, so the banner links straight there.
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function EmailDeliverabilityBanner() {
  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="container flex flex-wrap items-center gap-3 py-3 text-sm text-warning-soft">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1">
          Email to your address is paused because a message bounced or was marked as spam. You will
          still see every notification here.
        </p>
        <Link
          href="/dashboard/notifications/settings"
          className="rounded font-semibold text-white underline underline-offset-4 hover:text-warning-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
        >
          Change your email address
        </Link>
      </div>
    </div>
  );
}
