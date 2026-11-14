"use client";

// GCC - approve or reject an organiser application.
//
// Both actions call a server route that re-checks the application is pending.
// Approval grants the organiser claim; a rejection requires a written note that
// the applicant sees.
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

type Decision = "approve" | "reject";

export function ApplicationReviewActions({
  applicationId,
  gamerTag,
}: {
  readonly applicationId: string;
  readonly gamerTag: string;
}) {
  const refresh = useRefreshPreservingScroll();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function open(next: Decision) {
    setDecision(next);
    setNote("");
    setError(null);
    setNotice(null);
  }

  function close() {
    if (saving) return;
    setDecision(null);
    setError(null);
  }

  async function submit() {
    if (!decision) return;

    const trimmed = note.trim();

    if (decision === "reject" && trimmed.length < 10) {
      setError("Give the applicant at least 10 characters of feedback.");
      return;
    }

    if (trimmed.length > 300) {
      setError("Use 300 characters or fewer.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/super-admin/applications/${encodeURIComponent(applicationId)}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            decision === "reject" ? { note: trimmed } : { note: trimmed || null },
          ),
        },
      );
      const payload = (await response.json()) as { error?: string; alreadyReviewed?: boolean };

      if (!response.ok) {
        setError(payload.error ?? "The review could not be saved.");
        return;
      }

      setDecision(null);
      setNotice(
        decision === "approve"
          ? payload.alreadyReviewed
            ? "This application was already approved."
            : "Application approved and organiser role granted."
          : "Application rejected. The applicant has been notified.",
      );
      refresh();
    } catch {
      setError("The review could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const approving = decision === "approve";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => open("approve")}>
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Approve
        </Button>
        <Button variant="danger" size="sm" onClick={() => open("reject")}>
          <XCircle aria-hidden="true" className="h-4 w-4" />
          Reject
        </Button>
        {notice ? <p className="text-sm text-success-soft">{notice}</p> : null}
      </div>

      <Dialog
        open={decision !== null}
        onOpenChange={(openState) => {
          if (!openState) close();
        }}
        title={approving ? "Approve this application?" : "Reject this application?"}
        description={
          approving
            ? `@${gamerTag} receives the organiser role. They must sign in again before the new claim is active.`
            : `@${gamerTag} is told the application was not approved and sees your note and the reapply date.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant={approving ? "primary" : "danger"}
              loading={saving}
              loadingLabel="Saving"
              onClick={() => void submit()}
            >
              {approving ? "Approve application" : "Reject application"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            htmlFor="review-note"
            label="Note"
            optional={approving}
            hint={
              approving
                ? "Optional. The applicant sees this note with the approval."
                : "Required, 10-300 characters. The applicant sees this note."
            }
            error={error}
          >
            <Textarea
              id="review-note"
              value={note}
              rows={4}
              maxLength={300}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setError(null);
              }}
              placeholder={
                approving
                  ? "Anything the new organiser should know before they start."
                  : "Explain what was missing or what they should improve."
              }
            />
          </FormField>
        </div>
      </Dialog>
    </>
  );
}
