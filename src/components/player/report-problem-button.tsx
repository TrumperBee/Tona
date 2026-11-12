"use client";

// GCC - "Report a problem" on a completed match.
//
// Participants only. The report never changes the official result: it opens an
// admin-reviewed message with a required description of 10 to 500 characters.
// The server re-checks participation, one open report per match and rate limits.
import { CheckCircle2, Flag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";

export interface ReportProblemButtonProps {
  readonly tournamentId: string;
  readonly matchId: string;
  readonly matchLabel: string;
}

async function sendReport(
  tournamentId: string,
  matchId: string,
  reason: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      fields?: Record<string, string>;
    };

    return {
      ok: response.ok,
      error: response.ok
        ? null
        : ((body.fields && Object.values(body.fields)[0]) ??
          body.error ??
          "That report could not be sent."),
    };
  } catch {
    return { ok: false, error: "The connection failed. Check your network and try again." };
  }
}

export function ReportProblemButton({
  tournamentId,
  matchId,
  matchLabel,
}: ReportProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(): Promise<void> {
    const trimmed = reason.trim();

    if (trimmed.length < 10 || trimmed.length > 500) {
      setError("Describe the problem in 10 to 500 characters.");
      return;
    }

    setBusy(true);
    const result = await sendReport(tournamentId, matchId, trimmed);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setReason("");
    setSent(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Flag aria-hidden="true" className="h-3.5 w-3.5" />}
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
        >
          Report a problem
        </Button>
        {sent ? (
          <p
            role="status"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-soft"
          >
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            Reported. The organiser will review it.
          </p>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            setError(null);
          }
        }}
        title="Report a problem"
        description={`${matchLabel}. The organiser reviews your message; the result is not changed automatically.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={submit}>
              Send report
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor={`report-reason-${matchId}`}
            className="block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            What is wrong? (10–500 characters)
          </label>
          <Textarea
            id={`report-reason-${matchId}`}
            value={reason}
            maxLength={500}
            placeholder="For example: the score is recorded backwards."
            onChange={(event) => setReason(event.target.value)}
          />
          {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
