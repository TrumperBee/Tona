"use client";

// GCC - the primary registration action on a tournament page.
//
// The server computes the effective registration state with the pure
// `getRegistrationState` and passes it with the viewer's own situation; this
// component renders exactly one honest action, and handles the withdraw
// confirmation for an already-registered player.
import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";
import type { RegistrationState } from "@/lib/tournament/registration-state";

export interface RegisterActionProps {
  readonly tournamentId: string;
  readonly slug: string;
  readonly state: RegistrationState;
  readonly signedIn: boolean;
  readonly registered: boolean;
  /** Pre-formatted opening moment for the `opens_soon` label. */
  readonly opensAtLabel: string | null;
}

interface WithdrawState {
  readonly open: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

export function RegisterAction({
  tournamentId,
  slug,
  state,
  signedIn,
  registered,
  opensAtLabel,
}: RegisterActionProps) {
  const refresh = useRefreshPreservingScroll();
  const [withdraw, setWithdraw] = useState<WithdrawState>({
    open: false,
    loading: false,
    error: null,
  });

  async function confirmWithdraw(): Promise<void> {
    setWithdraw((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setWithdraw((current) => ({
          ...current,
          loading: false,
          error: body?.error ?? "The withdrawal could not be saved. Try again.",
        }));
        return;
      }

      setWithdraw({ open: false, loading: false, error: null });
      refresh();
    } catch {
      setWithdraw((current) => ({
        ...current,
        loading: false,
        error: "The withdrawal could not be saved. Try again.",
      }));
    }
  }

  // A registered player always sees their entry first; withdrawal stays
  // possible while registration is open, even if the window has ended.
  if (registered) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-success-soft">
          You are registered for this competition.
        </p>
        {state === "open" ? (
          <>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setWithdraw({ open: true, loading: false, error: null })}
            >
              Withdraw entry
            </Button>
            <ConfirmDialog
              open={withdraw.open}
              onOpenChange={(open) => setWithdraw((current) => ({ ...current, open }))}
              title="Withdraw your entry?"
              description="Your place is released immediately and another player can take it. You can register again while registration stays open."
              confirmLabel="Withdraw"
              loading={withdraw.loading}
              onConfirm={confirmWithdraw}
            />
            {withdraw.error ? <p className="text-xs text-danger-soft">{withdraw.error}</p> : null}
          </>
        ) : null}
      </div>
    );
  }

  if (state !== "open") {
    if (state === "opens_soon") {
      return (
        <div className="space-y-2">
          <p className={buttonStyles({ variant: "secondary", className: "w-full" })}>
            Registration opens {opensAtLabel ?? "soon"}
          </p>
          <p className="text-xs leading-5 text-grey-500">
            Come back when the entry window opens — the countdown above tracks it.
          </p>
        </div>
      );
    }

    if (state === "full") {
      return (
        <div className="space-y-2">
          <p className={buttonStyles({ variant: "secondary", className: "w-full" })}>
            Tournament full
          </p>
          <p className="text-xs leading-5 text-grey-500">
            All {`36`} places are taken. Withdrawn places reopen automatically.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className={buttonStyles({ variant: "secondary", className: "w-full" })}>
          Registration closed
        </p>
        <p className="text-xs leading-5 text-grey-500">
          Entries are no longer accepted for this competition.
        </p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/tournaments/${slug}/register`)}`}
        className={buttonStyles({ className: "w-full" })}
      >
        Sign in to register
      </Link>
    );
  }

  return (
    <Link href={`/tournaments/${slug}/register`} className={buttonStyles({ className: "w-full" })}>
      Register
    </Link>
  );
}
