"use client";

// GCC - password reset request.
//
// Firebase sends the reset email. The result message is identical whether or not
// the address belongs to an account.
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
    } finally {
      setSubmitted(true);
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
