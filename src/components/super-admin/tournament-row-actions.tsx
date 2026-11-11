"use client";

// GCC - Super Admin tournament management actions.
//
// Suspend, unsuspend, cancel and transfer ownership. Every action requires a
// reason that is written to the audit log and shown to the affected organiser
// in their notification. The eligibility shown here mirrors the pure server
// transition matrix; the server re-checks everything inside its transaction.
import { ArrowRightLeft, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { canTransition, type TournamentStatus } from "@/types/domain";

const REASON_MIN = 5;
const REASON_MAX = 300;
const CANCEL_MIN = 10;
const CANCEL_MAX = 500;

interface OrganiserResult {
  readonly uid: string;
  readonly gamerTag: string;
  readonly organisationName: string;
}

interface ActionResponse {
  readonly error?: string;
  readonly fields?: Record<string, string>;
}

async function postAction(url: string, body: unknown): Promise<ActionResponse | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return null;
    }

    return (await response.json().catch(() => ({}))) as ActionResponse;
  } catch {
    return { error: "The connection failed. Check your network and try again." };
  }
}

type DialogKind = "suspend" | "unsuspend" | "cancel" | "transfer" | null;

export function TournamentRowActions({
  tournamentId,
  name,
  status,
}: {
  readonly tournamentId: string;
  readonly name: string;
  readonly status: TournamentStatus;
}) {
  const router = useRouter();

  const canSuspend = canTransition(status, "suspended");
  const canUnsuspend = status === "suspended";
  const canCancel = canTransition(status, "cancelled");

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ActionResponse | null>(null);
  const [reason, setReason] = useState("");

  // Transfer combobox state.
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<readonly OrganiserResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OrganiserResult | null>(null);

  const trimmed = reason.trim();
  const reasonValid =
    dialog === "cancel"
      ? trimmed.length >= CANCEL_MIN && trimmed.length <= CANCEL_MAX
      : trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;
  const isCancel = dialog === "cancel";
  const maxReason = isCancel ? CANCEL_MAX : REASON_MAX;
  const visibleResults = dialog === "transfer" && term.trim().length >= 2 ? results : null;
  const visibleSearching = dialog === "transfer" && term.trim().length >= 2 && searching;

  useEffect(() => {
    if (dialog !== "transfer") {
      return;
    }

    const prefix = term.trim();

    if (prefix.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(
          `/api/super-admin/organisers?search=${encodeURIComponent(prefix)}`,
          { signal: controller.signal },
        );
        const body = (await response.json().catch(() => ({}))) as {
          readonly organisers?: OrganiserResult[];
          readonly error?: string;
        };

        setResults(response.ok ? (body.organisers ?? []) : []);
      } catch (searchError) {
        if ((searchError as { name?: string }).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, dialog]);

  function open(kind: DialogKind): void {
    setFailure(null);
    setReason("");
    setTerm("");
    setSelected(null);
    setResults(null);
    setDialog(kind);
  }

  async function run(): Promise<void> {
    if (!dialog || busy || !reasonValid) {
      return;
    }

    if (dialog === "transfer" && !selected) {
      return;
    }

    setBusy(true);
    setFailure(null);

    const url =
      dialog === "suspend"
        ? `/api/super-admin/tournaments/${tournamentId}/suspend`
        : dialog === "unsuspend"
          ? `/api/super-admin/tournaments/${tournamentId}/unsuspend`
          : dialog === "cancel"
            ? `/api/super-admin/tournaments/${tournamentId}/cancel`
            : `/api/super-admin/tournaments/${tournamentId}/transfer`;

    const body =
      dialog === "transfer" ? { uid: selected?.uid, reason: trimmed } : { reason: trimmed };

    const failureResponse = await postAction(url, body);

    if (failureResponse) {
      setFailure(failureResponse);
      setBusy(false);
      return;
    }

    setDialog(null);
    router.refresh();
  }

  const title =
    dialog === "suspend"
      ? `Suspend ${name}?`
      : dialog === "unsuspend"
        ? `Restore ${name}?`
        : dialog === "cancel"
          ? `Cancel ${name}?`
          : `Transfer ${name}`;

  const description =
    dialog === "suspend"
      ? "The competition is hidden from every public surface and its workspace is paused. The exact stage is recorded and restored when you unsuspend it."
      : dialog === "unsuspend"
        ? "The competition returns to the exact stage it was suspended from. The organiser is notified with your reason."
        : dialog === "cancel"
          ? "A cancelled competition never resumes and every registered player is notified with your reason; entrants keep their records."
          : "The competition moves to another organiser. Their gamer tag and organisation are re-snapshotted so public pages stay correct, and both organisers are notified.";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canSuspend ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<PauseCircle aria-hidden="true" className="h-4 w-4" />}
          onClick={() => open("suspend")}
        >
          Suspend
        </Button>
      ) : null}

      {canUnsuspend ? (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlayCircle aria-hidden="true" className="h-4 w-4" />}
          onClick={() => open("unsuspend")}
        >
          Unsuspend
        </Button>
      ) : null}

      {canCancel ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<XCircle aria-hidden="true" className="h-4 w-4" />}
          onClick={() => open("cancel")}
        >
          Cancel
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowRightLeft aria-hidden="true" className="h-4 w-4" />}
        onClick={() => open("transfer")}
      >
        Transfer
      </Button>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!busy && !open) {
            setDialog(null);
          }
        }}
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={dialog === "suspend" || dialog === "cancel" ? "danger" : "primary"}
              loading={busy}
              loadingLabel="Applying"
              disabled={!reasonValid || (dialog === "transfer" && !selected)}
              onClick={() => void run()}
            >
              {dialog === "suspend"
                ? "Suspend competition"
                : dialog === "unsuspend"
                  ? "Restore competition"
                  : dialog === "cancel"
                    ? "Cancel competition"
                    : "Transfer ownership"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {dialog === "transfer" ? (
            <div className="space-y-2">
              <label
                htmlFor={`transfer-search-${tournamentId}`}
                className="block text-sm font-medium text-grey-200"
              >
                New owner (search organisers by gamer tag)
              </label>
              <Input
                id={`transfer-search-${tournamentId}`}
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="At least 2 characters"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {visibleSearching ? (
                <p className="text-xs text-grey-500" aria-live="polite">
                  Searching organisers…
                </p>
              ) : null}
              {selected ? (
                <p className="rounded-lg border border-electric-400/30 bg-electric-500/10 px-3 py-2 text-sm text-white">
                  Selected: @{selected.gamerTag}
                  {selected.organisationName ? ` — ${selected.organisationName}` : ""}
                </p>
              ) : null}
              {visibleResults && visibleResults.length === 0 && !visibleSearching ? (
                <p className="text-xs text-grey-500">
                  No organisers match that prefix. Only real organiser accounts can take ownership.
                </p>
              ) : null}
              {visibleResults && visibleResults.length > 0 && !selected ? (
                <ul
                  className="max-h-44 space-y-1.5 overflow-y-auto"
                  aria-label="Matching organisers"
                >
                  {visibleResults.map((organiser) => (
                    <li key={organiser.uid}>
                      <button
                        type="button"
                        onClick={() => setSelected(organiser)}
                        className="w-full rounded-lg border border-white/10 bg-navy-950/50 px-3 py-2 text-left text-sm text-grey-200 transition-colors hover:border-electric-400/40 hover:text-white"
                      >
                        <span className="font-display font-semibold uppercase tracking-display text-white">
                          @{organiser.gamerTag}
                        </span>
                        {organiser.organisationName ? (
                          <span className="block text-xs text-grey-500">
                            {organiser.organisationName}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor={`action-reason-${tournamentId}`}
              className="block text-sm font-medium text-grey-200"
            >
              Reason ({isCancel ? `${CANCEL_MIN}-${CANCEL_MAX}` : `${REASON_MIN}-${REASON_MAX}`}{" "}
              characters, audited and shown to the organiser)
            </label>
            <Textarea
              id={`action-reason-${tournamentId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={maxReason + 1}
              placeholder="For example: verifying a reported fixture dispute."
            />
          </div>

          {failure ? (
            <div role="alert" className="space-y-1">
              {failure.error ? (
                <p className="text-sm font-medium leading-6 text-danger-soft">{failure.error}</p>
              ) : null}
              {failure.fields ? (
                <ul className="list-inside list-disc text-sm leading-6 text-danger-soft">
                  {Object.entries(failure.fields).map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
