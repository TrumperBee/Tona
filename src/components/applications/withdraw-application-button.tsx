"use client";

// GCC - withdraw a pending organiser application.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function WithdrawApplicationButton({ applicationId }: { readonly applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin-applications/${encodeURIComponent(applicationId)}/withdraw`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "The application could not be withdrawn.");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("The application could not be withdrawn. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Withdraw application
        </Button>
        {error ? (
          <p role="alert" className="text-xs font-medium text-danger-soft">
            {error}
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Withdraw this application?"
        description="The review queue will remove it and it will be marked withdrawn. You can submit a new application if you are eligible."
        confirmLabel="Withdraw"
        loading={loading}
        onConfirm={() => void withdraw()}
      />
    </>
  );
}
