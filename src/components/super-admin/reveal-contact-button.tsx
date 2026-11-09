"use client";

// GCC - reveal a private WhatsApp number on demand.
//
// The server returns the number only after writing an audit entry. Until then
// the page shows a masked value.
import { useState } from "react";

import { Button } from "@/components/ui/button";

export interface RevealContactButtonProps {
  readonly uid: string;
  readonly masked: string;
}

export function RevealContactButton({ uid, masked }: RevealContactButtonProps) {
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { whatsapp?: string; error?: string };

      if (!response.ok || !payload.whatsapp) {
        setError(payload.error ?? "The number could not be revealed.");
        return;
      }

      setNumber(payload.whatsapp);
    } catch {
      setError("The number could not be revealed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-white">{number ?? masked}</span>
        {number === null ? (
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            loadingLabel="Revealing"
            onClick={() => void reveal()}
          >
            Reveal number
          </Button>
        ) : (
          <span className="text-xs text-gold-300">Revealed and audited</span>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
