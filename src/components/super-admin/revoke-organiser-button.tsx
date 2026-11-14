"use client";

// GCC - revoke organiser privileges with a required reason.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export interface RevokeOrganiserButtonProps {
  readonly uid: string;
  readonly gamerTag: string;
}

export function RevokeOrganiserButton({ uid, gamerTag }: RevokeOrganiserButtonProps) {
  const refresh = useRefreshPreservingScroll();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) {
      setError("Give a reason of at least 5 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "The role change could not be saved.");
        return;
      }

      setOpen(false);
      setReason("");
      refresh();
    } catch {
      setError("The role change could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Revoke organiser privileges
      </Button>

      <Dialog
        open={open}
        onOpenChange={(openState) => {
          if (!openState && !saving) setOpen(false);
        }}
        title="Revoke organiser privileges"
        description={`@${gamerTag} will return to the participant role. Their tournaments and records are not deleted.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={saving}
              loadingLabel="Revoking"
              onClick={() => void submit()}
            >
              Revoke organiser role
            </Button>
          </>
        }
      >
        <FormField
          htmlFor="role-reason"
          label="Reason"
          hint="At least 5 characters. Stored in the audit log."
          error={error}
        >
          <Textarea
            id="role-reason"
            value={reason}
            rows={3}
            maxLength={300}
            onChange={(event) => {
              setReason(event.currentTarget.value);
              setError(null);
            }}
            placeholder="Why are organiser privileges being revoked?"
          />
        </FormField>
      </Dialog>
    </>
  );
}
