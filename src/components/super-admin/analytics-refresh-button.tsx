"use client";

// GCC - manual analytics refresh.
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export function AnalyticsRefreshButton() {
  const refreshView = useRefreshPreservingScroll();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runRefresh() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/super-admin/analytics/refresh", { method: "POST" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Analytics could not be refreshed.");
        return;
      }

      refreshView();
    } catch {
      setError("Analytics could not be refreshed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        loading={loading}
        loadingLabel="Refreshing"
        leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
        onClick={() => void runRefresh()}
      >
        Refresh
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
