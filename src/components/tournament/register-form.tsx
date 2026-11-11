"use client";

// GCC - tournament entry confirmation form.
//
// The player confirms they accept the organiser's published rules, then the
// entry is recorded by the server, which re-checks everything inside one
// Firestore transaction. Nothing about the player is trusted from the browser.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/feedback";

export interface RegisterFormProps {
  readonly tournamentId: string;
  readonly slug: string;
}

export function RegisterForm({ tournamentId, slug }: RegisterFormProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!accepted || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The entry could not be recorded. Try again.");
        setLoading(false);
        return;
      }

      setDone(true);
      setLoading(false);
      router.refresh();
    } catch {
      setError("The entry could not be recorded. Try again.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 aria-hidden="true" className="h-12 w-12 text-success" />
        <div>
          <p className="font-display text-2xl font-semibold uppercase tracking-display text-white">
            You are in
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-grey-400">
            Your entry is recorded and your place is held. Watch the tournament page for the
            schedule, and your dashboard for organiser announcements.
          </p>
        </div>
        <Link
          href={`/tournaments/${slug}`}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          Back to tournament
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4">
        <Checkbox
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          id="accept-rules"
        />
        <span className="text-sm leading-6 text-grey-300">
          I have read the published rules above and the platform{" "}
          <Link
            href="/terms"
            className="rounded font-medium text-electric-300 underline-offset-4 hover:underline"
          >
            terms
          </Link>
          , and I commit to the schedule, the match length and the entry restrictions of this
          competition.
        </span>
      </label>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-soft">
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={!accepted || loading} className="w-full sm:w-auto">
        {loading ? <Spinner className="h-4 w-4" /> : null}
        {loading ? "Recording your entry…" : "Confirm entry"}
      </Button>

      <p className="text-xs leading-5 text-grey-500">
        One entry per player. Withdrawing is possible while registration stays open; a withdrawn
        place is released to other players immediately.
      </p>
    </div>
  );
}
