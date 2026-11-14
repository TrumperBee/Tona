"use client";

// GCC - account status actions with a required reason and confirmation.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";
import type { AccountStatus } from "@/types/domain";

const actionCopy: Record<
  AccountStatus,
  { readonly title: string; readonly confirm: string; readonly description: string }
> = {
  active: {
    title: "Restore this account",
    confirm: "Restore account",
    description:
      "The Firebase Auth user is enabled again and both profile documents are updated. Existing records stay intact.",
  },
  suspended: {
    title: "Suspend this account",
    confirm: "Suspend account",
    description:
      "The player is signed out, refresh tokens are revoked and their public profile shows 'Profile unavailable'.",
  },
  banned: {
    title: "Ban this account",
    confirm: "Ban account",
    description:
      "The player is signed out, refresh tokens are revoked and their public profile shows 'Profile unavailable'.",
  },
};

export interface UserStatusActionsProps {
  readonly uid: string;
  readonly gamerTag: string;
  readonly status: AccountStatus;
}

export function UserStatusActions({ uid, gamerTag, status }: UserStatusActionsProps) {
  const refresh = useRefreshPreservingScroll();
  const [action, setAction] = useState<AccountStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function open(next: AccountStatus) {
    setAction(next);
    setReason("");
    setError(null);
  }

  function close() {
    if (saving) return;
    setAction(null);
    setError(null);
  }

  async function submit() {
    if (!action) return;

    if (reason.trim().length < 5) {
      setError("Give a reason of at least 5 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, reason: reason.trim() }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "The status change could not be saved.");
        return;
      }

      setAction(null);
      setReason("");
      refresh();
    } catch {
      setError("The status change could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const copy = action ? actionCopy[action] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status !== "suspended" ? (
          <Button variant="secondary" size="sm" onClick={() => open("suspended")}>
            Suspend
          </Button>
        ) : null}
        {status !== "banned" ? (
          <Button variant="danger" size="sm" onClick={() => open("banned")}>
            Ban
          </Button>
        ) : null}
        {status !== "active" ? (
          <Button size="sm" onClick={() => open("active")}>
            Restore
          </Button>
        ) : null}
      </div>

      <Dialog
        open={action !== null}
        onOpenChange={(openState) => {
          if (!openState) close();
        }}
        title={copy?.title ?? "Change account status"}
        description={copy?.description}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant={action === "active" ? "primary" : "danger"}
              loading={saving}
              loadingLabel="Saving"
              onClick={() => void submit()}
            >
              {copy?.confirm ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-grey-300">
            Account: <span className="font-semibold text-white">@{gamerTag}</span>
          </p>
          <FormField
            htmlFor="status-reason"
            label="Reason"
            hint="At least 5 characters. Stored in the audit log; never shown publicly."
            error={error}
          >
            <Textarea
              id="status-reason"
              value={reason}
              rows={3}
              maxLength={300}
              onChange={(event) => {
                setReason(event.currentTarget.value);
                setError(null);
              }}
              placeholder="Why is this account status changing?"
            />
          </FormField>
        </div>
      </Dialog>
    </>
  );
}
