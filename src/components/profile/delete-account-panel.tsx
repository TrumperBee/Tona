"use client";

// GCC — self-service account deletion in profile settings.
//
// The server enforces a fresh sign-in, same-origin and all deletion policy.
// This panel only makes the irreversible choice explicit: type DELETE, read the
// retention note, then call the route. No gamer tag or tournament slot is
// released by this action.
import { AlertCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

interface DeleteAccountPanelProps {
  readonly gamerTag: string;
}

export function DeleteAccountPanel({ gamerTag }: DeleteAccountPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const confirmed = confirmation === DELETE_ACCOUNT_CONFIRMATION;

  function close(): void {
    if (loading) {
      return;
    }

    setOpen(false);
    setConfirmation("");
    setError(null);
    setNeedsSignIn(false);
  }

  async function removeAccount(): Promise<void> {
    if (!confirmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsSignIn(false);

    try {
      const response = await fetch("/api/profile/account", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "We could not delete your account. Try again.");
        setNeedsSignIn(response.status === 401);
        return;
      }

      // The server cleared the http-only cookie; clear the Firebase client too.
      const { signOutCompletely } = await import("@/lib/auth/client");
      await signOutCompletely();
      router.refresh();
      router.push("/?account=deleted");
    } catch {
      setError("The connection failed. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      title="Delete my account"
      description="Remove your sign-in and personal details while keeping the public competition record."
    >
      <div className="space-y-4 text-sm leading-6 text-grey-400">
        <p>
          Deleting removes your Firebase sign-in, email address, full name, WhatsApp number,
          community, favourite club and profile photo/avatar. Your public profile becomes{" "}
          <strong className="text-grey-200">Deleted player</strong> with no avatar.
        </p>
        <p>
          Your gamer tag <strong className="text-grey-200">@{gamerTag}</strong> stays reserved.
          Tournament entries are not withdrawn and no place is released; organisers see
          &ldquo;Deleted player&rdquo; in their registrations. Completed matches, standings and
          titles keep your gamer tag as part of the permanent record. Super Admins and organisers
          with active tournaments cannot delete their account here.
        </p>
        <p>
          For your protection you must have signed in within the last ten minutes. If your sign-in
          is older, the form will ask you to sign in again.
        </p>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-danger-soft"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {error}{" "}
              {needsSignIn ? (
                <Link
                  href="/login?next=/dashboard/profile/edit"
                  className="font-semibold underline underline-offset-4"
                >
                  Sign in again
                </Link>
              ) : null}
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          variant="danger"
          onClick={() => setOpen(true)}
          leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
        >
          Delete my account
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="Delete your account?"
        size="sm"
        description={
          <span>
            This cannot be undone. Type <strong className="text-white">DELETE</strong> to confirm.
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void removeAccount()}
              disabled={!confirmed || loading}
              loading={loading}
              loadingLabel="Deleting"
            >
              Permanently delete
            </Button>
          </>
        }
      >
        <FormField
          htmlFor="confirm-account-deletion"
          label="Type DELETE to confirm"
          hint="Your gamer tag and competition history are deliberately retained."
        >
          <Input
            id="confirm-account-deletion"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={loading}
          />
        </FormField>
      </Dialog>
    </SectionCard>
  );
}
