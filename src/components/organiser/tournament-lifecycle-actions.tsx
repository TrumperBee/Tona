"use client";

// GCC - tournament lifecycle action controls.
//
// Statuses never change on a schedule; these buttons call the explicit
// lifecycle routes, each of which re-verifies ownership and the transition
// matrix inside a Firestore transaction and writes an audit entry. Confirm
// dialogs guard the destructive ones; cancelling needs a reason that is shown
// to every registered player.
import { DoorOpen, Rocket, Trash2, Undo2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { TournamentStatus } from "@/types/domain";

const CANCEL_MIN = 10;
const CANCEL_MAX = 500;

interface LifecycleResponse {
  readonly error?: string;
  readonly fields?: Record<string, string>;
}

async function lifecycleRequest(
  url: string,
  init?: RequestInit,
): Promise<{ readonly ok: boolean; readonly body: LifecycleResponse }> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as LifecycleResponse;

    return { ok: response.ok, body };
  } catch {
    return {
      ok: false,
      body: { error: "The connection failed. Check your network and try again." },
    };
  }
}

function ActionError({ error, fields }: LifecycleResponse): React.ReactNode {
  if (!error && !fields) {
    return null;
  }

  return (
    <div role="alert" className="space-y-1.5">
      {error ? <p className="text-sm font-medium leading-6 text-danger-soft">{error}</p> : null}
      {fields ? (
        <ul className="list-inside list-disc text-sm leading-6 text-danger-soft">
          {Object.entries(fields).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The primary lifecycle action for the current status: publish (draft), close
 * registration (open) or reopen registration (closed, pre-pots).
 */
export function PrimaryLifecycleActions({
  tournamentId,
  status,
}: {
  readonly tournamentId: string;
  readonly status: TournamentStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<LifecycleResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const action =
    status === "draft"
      ? {
          label: "Publish competition",
          icon: <Rocket aria-hidden="true" className="h-4 w-4" />,
          dialogTitle: "Publish this competition?",
          dialogDescription:
            "Publishing moves the competition to registration open immediately and lists it publicly. Description, rules and all three schedule moments must be complete, the registration deadline must be in the future, and the start within 18 months. Everything is checked again on the server.",
        }
      : status === "registration_open"
        ? {
            label: "Close registration",
            icon: <DoorOpen aria-hidden="true" className="h-4 w-4" />,
            dialogTitle: "Close registration now?",
            dialogDescription:
              "Entries stop immediately, even if the published deadline is later. The stored deadline keeps its meaning for history, and registration can be reopened later while the pots are not confirmed.",
          }
        : status === "registration_closed"
          ? {
              label: "Reopen registration",
              icon: <Undo2 aria-hidden="true" className="h-4 w-4" />,
              dialogTitle: "Reopen registration?",
              dialogDescription:
                "Players can enter again up to the field size. This is only possible while the pots have not been confirmed.",
            }
          : null;

  async function run(): Promise<void> {
    if (!action || busy) {
      return;
    }

    setBusy(true);
    setFailure(null);

    const url =
      status === "draft"
        ? `/api/organiser/tournaments/${tournamentId}/publish`
        : status === "registration_open"
          ? `/api/organiser/tournaments/${tournamentId}/close-registration`
          : `/api/organiser/tournaments/${tournamentId}/reopen-registration`;

    const { ok, body } = await lifecycleRequest(url, { method: "POST" });

    if (!ok) {
      setFailure(body);
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    router.refresh();
    setBusy(false);
    return;
  }

  if (!action) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => setConfirmOpen(true)} leftIcon={action.icon} disabled={busy}>
        {action.label}
      </Button>

      {failure ? <ActionError {...failure} /> : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) {
            setConfirmOpen(open);
          }
        }}
        title={action.dialogTitle}
        description={action.dialogDescription}
        confirmLabel={action.label}
        tone="primary"
        loading={busy}
        onConfirm={() => void run()}
      />
    </div>
  );
}

/**
 * The destructive zone: cancel a live competition (reason required, every
 * registered player is notified) and delete a never-published draft.
 */
export function TournamentDangerZone({
  tournamentId,
  status,
  name,
}: {
  readonly tournamentId: string;
  readonly status: TournamentStatus;
  readonly name: string;
}) {
  const router = useRouter();

  const canCancel = !(
    status === "draft" ||
    status === "completed" ||
    status === "archived" ||
    status === "cancelled" ||
    status === "suspended"
  );
  const canDelete = status === "draft";

  const [busy, setBusy] = useState<"cancel" | "delete" | null>(null);
  const [failure, setFailure] = useState<LifecycleResponse | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!canCancel && !canDelete) {
    return null;
  }

  async function cancel(): Promise<void> {
    const trimmed = reason.trim();

    if (busy || trimmed.length < CANCEL_MIN || trimmed.length > CANCEL_MAX) {
      return;
    }

    setBusy("cancel");
    setFailure(null);

    const { ok, body } = await lifecycleRequest(
      `/api/organiser/tournaments/${tournamentId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      },
    );

    if (!ok) {
      setFailure(body);
      return;
    }

    setCancelOpen(false);
    setReason("");
    router.refresh();
  }

  async function remove(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy("delete");
    setFailure(null);

    const { ok, body } = await lifecycleRequest(`/api/organiser/tournaments/${tournamentId}`, {
      method: "DELETE",
    });

    if (!ok) {
      setFailure(body);
      return;
    }

    // The workspace no longer exists; return to the organiser's list.
    router.push("/organiser/tournaments");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canCancel ? (
        <>
          <Button
            variant="danger"
            leftIcon={<XCircle aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setCancelOpen(true)}
            disabled={busy !== null}
          >
            Cancel competition
          </Button>
          <p className="text-xs leading-5 text-grey-500">
            A cancelled competition never resumes. Every registered player is notified with your
            reason and keeps their entry record.
          </p>
        </>
      ) : null}

      {canDelete ? (
        <>
          <Button
            variant="danger"
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setDeleteOpen(true)}
            disabled={busy !== null}
          >
            Delete draft
          </Button>
          <p className="text-xs leading-5 text-grey-500">
            Permanently deletes this never-published draft and releases its public address. This
            cannot be undone.
          </p>
        </>
      ) : null}

      {failure ? <ActionError {...failure} /> : null}

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (busy !== "cancel") {
            setCancelOpen(open);
          }
        }}
        title={`Cancel ${name}?`}
        description="A cancelled competition never resumes and leaves the public lists. Every registered player is notified with your reason; entrants keep their records."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={busy === "cancel"}
            >
              Keep it running
            </Button>
            <Button
              variant="danger"
              loading={busy === "cancel"}
              loadingLabel="Cancelling"
              disabled={reason.trim().length < CANCEL_MIN || reason.trim().length > CANCEL_MAX}
              onClick={() => void cancel()}
            >
              Cancel competition
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-grey-200">
            Reason ({CANCEL_MIN}-{CANCEL_MAX} characters, shown to every registered player)
          </label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={CANCEL_MAX + 1}
            placeholder="For example: the venue fell through and the season cannot be rescheduled."
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (busy !== "delete") {
            setDeleteOpen(open);
          }
        }}
        title={`Delete the draft "${name}"?`}
        description="The draft and its reserved public address are permanently deleted. It was never published, so no player data exists. This cannot be undone."
        confirmLabel="Delete draft"
        loading={busy === "delete"}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
