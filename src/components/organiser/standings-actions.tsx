"use client";

// GCC - organiser standings repair controls.
//
// Two explicit actions, never a manual row edit: verify compares the stored
// table with a fresh computation, and recalculate rebuilds it. Both call the
// server guard; the button state only previews what the server allows.
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Action = "recalculate" | "verify";

interface VerifyPayload {
  readonly valid: boolean;
  readonly checked: number;
  readonly completedMatches: number;
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
  readonly mismatches: readonly { readonly uid: string; readonly fields: readonly string[] }[];
}

interface RecalculatePayload {
  readonly players: number;
  readonly completedMatches: number;
}

export function StandingsActions({ tournamentId }: { readonly tournamentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: Action): Promise<void> {
    setBusy(action);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/organiser/tournaments/${tournamentId}/standings/${action === "recalculate" ? "recalculate" : "verify"}`,
        {
          method: action === "recalculate" ? "POST" : "GET",
          headers: action === "recalculate" ? { "Content-Type": "application/json" } : undefined,
        },
      );

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        setMessage({
          ok: false,
          text:
            typeof payload.error === "string"
              ? payload.error
              : "The request failed. Try again shortly.",
        });
        return;
      }

      if (action === "recalculate") {
        const result = payload as unknown as RecalculatePayload;
        setMessage({
          ok: true,
          text: `Rebuilt ${result.players} rows from ${result.completedMatches} completed league matches.`,
        });
        router.refresh();
        return;
      }

      const result = payload as unknown as VerifyPayload;
      const detail = [
        result.missing.length > 0 ? `${result.missing.length} missing rows` : null,
        result.unexpected.length > 0 ? `${result.unexpected.length} unexpected rows` : null,
        result.mismatches.length > 0 ? `${result.mismatches.length} mismatched rows` : null,
      ]
        .filter((entry): entry is string => entry !== null)
        .join(", ");

      setMessage({
        ok: result.valid,
        text: result.valid
          ? `Verified ${result.checked} stored rows against a fresh computation.`
          : `Mismatch found: ${detail || "stored rows differ from the recorded results"}.`,
      });
    } catch {
      setMessage({ ok: false, text: "The connection failed. Check your network and try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Integrity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-grey-400">
          The table is derived from recorded results and cannot be edited by hand. Verify compares
          every stored row with a fresh computation; recalculate rebuilds the table if they differ.
          Both actions are available to the owner and Super Admin only.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run("verify")}
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            {busy === "verify" ? "Verifying…" : "Verify table"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run("recalculate")}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {busy === "recalculate" ? "Recalculating…" : "Recalculate"}
          </Button>
        </div>

        {message ? (
          <p
            role="status"
            className={
              message.ok
                ? "flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs leading-5 text-success"
                : "flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs leading-5 text-danger"
            }
          >
            {message.ok ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {message.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
