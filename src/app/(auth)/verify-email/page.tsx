// GCC - email verification.
// Reached only when an unverified account is detected after verification opens.
import { AuthNotice } from "@/components/auth/auth-notice";

export const metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthNotice
      eyebrow="Email verification"
      title="Verification is not open yet"
      description="Email verification begins when accounts open. Until then, no account can be verified and no verification link is valid."
      details={[
        "Verification protects tournament entries and organiser tools.",
        "Unverified accounts will be redirected here before they can use the platform.",
        "If you believe you reached this page in error, return to the public site.",
      ]}
      tone="warning"
      primaryAction={{ href: "/", label: "Back to home" }}
      secondaryAction={{ href: "/contact", label: "Contact the team" }}
    />
  );
}
