// GCC - password reset.
// Accounts are not open in Phase 3; no reset form is rendered.
import { AuthNotice } from "@/components/auth/auth-notice";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthNotice
      eyebrow="Account recovery"
      title="Password recovery is not available yet"
      description="Password reset will be handled by the account system once sign-in opens. No reset link can be requested today."
      details={[
        "GCC will never ask for your password by email, chat or social media.",
        "Reset links will be single-use and time-limited.",
      ]}
      primaryAction={{ href: "/login", label: "Back to sign in" }}
    />
  );
}
