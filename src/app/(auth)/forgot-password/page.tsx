// GCC - password reset request.
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
        Account recovery
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
        Reset your password
      </h1>
      <p className="mt-3 text-sm leading-6 text-grey-300">
        Enter your account email and Firebase will send a single-use reset link. GCC never asks for
        your password by email, chat or social media.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
