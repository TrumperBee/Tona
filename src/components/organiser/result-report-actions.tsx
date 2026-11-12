"use client";

// GCC - resolve or dismiss one result report with a required admin note.
//
// The same control is used by the organiser inbox and the Super Admin
// cross-tournament oversight page. The route re-checks ownership and the note
// length; this component only collects the decision.
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { ResultReportStatus } from "@/types/domain";

export interface ResultReportActionsProps {
  readonly tournamentId: string;
  readonly reportId: string;
  readonly status: ResultReportStatus;
}

type Decision = "resolved" | "dismissed";

async function postDecision(
  tournamentId: string,
  reportId: string,
  decision: Decision,
  adminNote: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const response = await fetch(
      `/api/organiser/tournaments/${tournamentId}/result-reports/${reportId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, adminNote }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      fields?: Record<string, string>;
    };

    return {
      ok: response.ok,
      error: response.ok
        ? null
        : ((body.fields && Object.values(body.fields)[0]) ?? body.error ?? "That action failed."),
    };
  } catch {
    return { ok: false, error: "The connection failed. Check your network and try again." };
  }
}

export function ResultReportActions({ tournamentId, reportId, status }: ResultReportActionsProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== "open") {
    return null;
  }

  async function submit(): Promise<void> {
    if (!decision) return;
    const trimmed = note.trim();

    if (trimmed.length < 5 || trimmed.length > 300) {
      setError("Add a note of 5 to 300 characters.");
      return;
    }

    setBusy(true);
    const result = await postDecision(tournamentId, reportId, decision, trimmed);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDecision(null);
    setNote("");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          leftIcon={<Check aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setDecision("resolved");
            setError(null);
          }}
        >
          Resolve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<X aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            setDecision("dismissed");
            setError(null);
          }}
        >
          Dismiss
        </Button>
      </div>

      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={decision === "resolved" ? "Resolve report" : "Dismiss report"}
        description="The reporter receives your note. Any result change must still be made on the Results page with its own reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision === "dismissed" ? "danger" : "primary"}
              loading={busy}
              onClick={submit}
            >
              {decision === "resolved" ? "Resolve report" : "Dismiss report"}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="report-admin-note"
            className="block text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
          >
            Note to the reporter (5–300 characters)
          </label>
          <Textarea
            id="report-admin-note"
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
          />
          {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
