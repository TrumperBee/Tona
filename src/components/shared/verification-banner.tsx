// GCC - email verification banner for the participant dashboard.
import { MailWarning } from "lucide-react";
import Link from "next/link";

export function VerificationBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MailWarning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-warning-soft">Verify your email address</p>
          <p className="mt-1 text-sm leading-6 text-grey-300">
            You can view your profile now. Tournament entry opens only after your email is verified.
          </p>
        </div>
      </div>
      <Link
        href="/verify-email"
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-warning/40 px-3 py-2 text-sm font-semibold text-warning-soft transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
      >
        Verify email
      </Link>
    </div>
  );
}
