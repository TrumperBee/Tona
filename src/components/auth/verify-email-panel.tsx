"use client";

// GCC - email verification panel.
//
// Firebase's hosted email action handler marks the address verified. This panel
// reloads the local user, force-refreshes the ID token, re-exchanges the session
// cookie and then continues to the dashboard.
import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import {
  authErrorMessage,
  refreshVerificationSession,
  sendVerificationEmail,
} from "@/lib/auth/client";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseClientAuth(), (nextUser) => {
      setUser(nextUser);
    });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend(): Promise<void> {
    if (!user || cooldown > 0) {
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      await sendVerificationEmail(user);
      setMessage("Verification email sent. Check your inbox and spam folder.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (sendError) {
      setError(authErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  async function checkVerification(): Promise<void> {
    setChecking(true);
    setError(null);
    setMessage(null);

    try {
      const { user: refreshed } = await refreshVerificationSession();

      if (!refreshed.emailVerified) {
        setMessage(
          "Your email is not verified yet. Open the link in the message, then try again. If it has expired, resend a new one.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (verifyError) {
      setError(authErrorMessage(verifyError));
    } finally {
      setChecking(false);
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-grey-400">Checking your session...</p>;
  }

  if (user === null) {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-grey-300">
          No browser session is available. Sign in to resend a verification email or check your
          status.
        </p>
        <Link href="/login" className={buttonStyles({ size: "lg", className: "w-full" })}>
          Sign in
        </Link>
      </div>
    );
  }

  if (user.emailVerified) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm leading-6 text-success-soft"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your email is verified. You can enter tournaments as soon as registration opens.</p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border border-electric-400/25 bg-electric-500/10 p-3">
        <MailCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-electric-300" />
        <div className="text-sm leading-6 text-grey-200">
          <p>
            We sent a verification link to{" "}
            <span className="font-semibold text-white">{user.email}</span>.
          </p>
          <p className="mt-1 text-grey-400">
            Open it, then return here and press “I’ve verified”. Unverified accounts can view their
            profile, but tournament entry requires a verified email.
          </p>
        </div>
      </div>

      {message ? (
        <p role="status" className="text-sm leading-6 text-grey-300">
          {message}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger-soft"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          onClick={checkVerification}
          loading={checking}
          loadingLabel="Checking"
          className="w-full"
        >
          I’ve verified
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={resend}
          loading={sending}
          loadingLabel="Sending"
          disabled={cooldown > 0}
          className="w-full"
        >
          {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
        </Button>
      </div>

      <p className="text-sm text-grey-400">
        <Link href="/dashboard" className="text-electric-300 underline-offset-2 hover:underline">
          Continue to dashboard without verifying
        </Link>
      </p>
    </div>
  );
}
