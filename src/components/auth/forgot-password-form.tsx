"use client";

// GCC - password reset request.
//
// Firebase sends the reset email. The result message is identical whether or not
// the address belongs to an account.
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/client";
import {
  TURNSTILE_CLIENT_FAILURE_MESSAGE,
  verifyClientTurnstile,
} from "@/lib/security/turnstile-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const verified = await verifyClientTurnstile("forgot_password", turnstileToken);

    if (!verified) {
      setError(TURNSTILE_CLIENT_FAILURE_MESSAGE);
      return;
    }

    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch {
      // The reset response is intentionally identical for known and unknown
      // addresses, so a transport error uses the same generic copy.
      setError("We could not send the reset link. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm leading-6 text-success-soft"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            If an account exists for that email, a password-reset link is on its way. Check your
            inbox and spam folder. The link is single-use and time-limited.
          </p>
        </div>
        <p className="text-sm text-grey-400">
          <Link href="/login" className="text-electric-300 underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger-soft"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <FormField htmlFor="email" label="Email" required hint="Use the address on your GCC account.">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
      </FormField>

      <div className="space-y-3" aria-label="Security check">
        <p className="text-xs leading-5 text-grey-400">
          This check helps protect password-reset requests from automated abuse.
        </p>
        <TurnstileWidget
          action="forgot_password"
          onToken={handleTurnstileToken}
          className="w-full min-w-0"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        loading={submitting}
        loadingLabel="Sending"
        className="w-full"
      >
        Send reset link
      </Button>

      <p className="text-sm text-grey-400">
        <Link href="/login" className="text-electric-300 underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
