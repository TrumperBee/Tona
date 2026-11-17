"use client";

// GCC - Super Admin "Recompute stats" action on one player.
import { Calculator } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export function RecomputeStatsButton({ uid }: { readonly uid: string }) {
  const refresh = useRefreshPreservingScroll();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/super-admin/stats/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerUid: uid }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "The recompute failed.");
        return;
      }

      setMessage("Statistics rebuilt from recorded matches.");
      refresh();
    } catch {
      setError("The recompute failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        loading={loading}
        loadingLabel="Recomputing"
        leftIcon={<Calculator aria-hidden="true" className="h-4 w-4" />}
        onClick={() => void run()}
      >
        Recompute stats
      </Button>
      {message ? (
        <p role="status" className="text-xs text-success-soft">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
