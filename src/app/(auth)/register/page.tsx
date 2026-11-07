// GCC - account registration.
// Accounts are not open in Phase 3; no registration form is rendered.
import { AuthNotice } from "@/components/auth/auth-notice";

export const metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthNotice
      eyebrow="Accounts"
      title="Registration is not open yet"
      description="Player and organiser accounts open with the first GCC season. There is no form to submit at this stage, and no personal details are being collected."
      details={[
        "Players will register a gamer tag, country, preferred game and platform.",
        "Email verification will be required before a tournament entry is accepted.",
        "Organiser status is granted by application and review, never by a public toggle.",
      ]}
    />
  );
}
