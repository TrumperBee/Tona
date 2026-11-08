// GCC - email verification.
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";

export const metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
        Email verification
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
        Verify your email
      </h1>
      <p className="mt-3 text-sm leading-6 text-grey-300">
        Verification protects tournament entries and keeps account recovery in your hands.
      </p>
      <div className="mt-8">
        <VerifyEmailPanel />
      </div>
    </div>
  );
}
