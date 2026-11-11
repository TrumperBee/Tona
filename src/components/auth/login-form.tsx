"use client";

// GCC - sign-in form.
//
// Errors are deliberately generic: the form never reveals whether an email has
// an account. The `next` parameter is sanitised before navigation.
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authErrorMessage, signInWithSession } from "@/lib/auth/client";
import { safeRedirectPath } from "@/lib/security/redirect";

export interface LoginFormProps {
  readonly nextPath: string | null;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signInWithSession(email, password);
      const safeNext = safeRedirectPath(nextPath);
      router.push(safeNext ?? "/dashboard");
      router.refresh();
    } catch (signInError) {
      setError(authErrorMessage(signInError));
    } finally {
      setSubmitting(false);
    }
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

      <FormField htmlFor="email" label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
      </FormField>

      <FormField htmlFor="password" label="Password" required>
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </FormField>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href="/forgot-password"
          className="text-electric-300 underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
        <Link href="/register" className="text-grey-300 underline-offset-2 hover:underline">
          Create account
        </Link>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={submitting}
        loadingLabel="Signing in"
        className="w-full"
      >
        Sign in
      </Button>
    </form>
  );
}
