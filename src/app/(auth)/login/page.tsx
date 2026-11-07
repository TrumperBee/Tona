// GCC - sign in.
// Accounts are not open in Phase 3; no authentication form is rendered.
import { AuthNotice } from "@/components/auth/auth-notice";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthNotice
      eyebrow="Accounts"
      title="Sign-in opens with the first season"
      description="GCC accounts are not open yet. When they are, you will sign in with a verified email address and be returned to the page you were trying to reach."
      details={[
        "No password or email should be entered anywhere on this site yet.",
        "Your session will be an http-only cookie; GCC never stores credentials in the browser.",
        "One account will cover every tournament you enter, with one permanent competitive record.",
      ]}
    />
  );
}
