"use client";

// GCC - confirm one email stream unsubscribe.
//
// The signed token does the authorisation, so the page never asks for an email
// address. The button posts once and then shows a confirmation.
import { useState } from "react";

import { Button } from "@/components/ui/button";

const CATEGORY_COPY: Record<string, { title: string; description: string }> = {
  important: {
    title: "important competition emails",
    description:
      "Entries, draws, published fixtures, knockout qualification and other competition changes will stop arriving by email. They will still appear in your dashboard.",
  },
  result: {
    title: "result emails",
    description:
      "Match and result-report emails will stop arriving. Results stay available on the site.",
  },
  announcement: {
    title: "announcement emails",
    description: "Platform and tournament announcement emails will stop arriving.",
  },
};

export function UnsubscribeForm({
  token,
  category,
}: {
  readonly token: string;
  readonly category: string;
}) {
  const copy = CATEGORY_COPY[category] ?? {
    title: "these emails",
    description: "Email from this stream will stop.",
  };
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState("saving");
    setError(null);

    try {
      const response = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Your preference could not be saved.");
        setState("error");
        return;
      }

      setState("done");
    } catch {
      setError("Your preference could not be saved. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="space-y-3 text-sm leading-7 text-grey-300">
        <p className="font-semibold text-white">You are unsubscribed.</p>
        <p>
          Future {copy.title} will not be sent to this address. Critical account and security emails
          cannot be turned off.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm leading-7 text-grey-300">
      <p>
        You are about to stop <strong className="text-white">{copy.title}</strong>.{" "}
        {copy.description}
      </p>
      <p>
        Critical account and security messages are not affected. You can re-enable every stream from
        the notification settings page while signed in.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger-soft"
        >
          {error}
        </p>
      ) : null}

      <Button onClick={() => void submit()} loading={state === "saving"} loadingLabel="Saving">
        Confirm unsubscribe
      </Button>
    </div>
  );
}
