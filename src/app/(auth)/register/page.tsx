// GCC - account registration.
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">Accounts</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
        Create your player account
      </h1>
      <p className="mt-3 text-sm leading-6 text-grey-300">
        One account covers every tournament you enter. Your gamer tag is permanent and anchors your
        competitive record.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
