"use client";

// GCC - change the account email address.
//
// The server requires a sign-in from the last ten minutes, rejects an address
// already in use, revokes every session and emails the old address. Success
// therefore signs the browser out, so the only next step offered is sign-in.
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface ApiError {
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
}

export function ChangeEmailForm({ maskedEmail }: { readonly maskedEmail: string }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(null);

    try {
      const response = await fetch("/api/profile/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiError & { email?: string };

      if (!response.ok) {
        setError(
          response.status === 401
            ? (payload.error ?? "Sign in again before changing your email address.")
            : (payload.error ?? "Your email address could not be changed."),
        );
        setFieldError(payload.fieldErrors?.email ?? null);
        return;
      }

      setDone(payload.email ?? email);
      setEmail("");
    } catch {
      setError("Your email address could not be changed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="space-y-3 text-sm leading-7 text-grey-300">
        <p className="font-semibold text-white">Your email address is now {done}.</p>
        <p>
          Every session was signed out and a notice was sent to your previous address. Sign in again
          with the new address to continue.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded text-electric-300 underline underline-offset-4 hover:text-electric-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
        >
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="text-sm leading-6 text-grey-400">
        Current address: <span className="font-medium text-grey-100">{maskedEmail}</span>
      </div>

      <FormField
        htmlFor="new-email"
        label="New email address"
        hint="You must have signed in within the last ten minutes. Changing it signs out every session."
        error={fieldError ?? undefined}
      >
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          required
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </FormField>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={saving} loadingLabel="Changing email address">
        Change email address
      </Button>
    </form>
  );
}
