"use client";

// GCC - email preference toggles.
//
// Critical account mail is not listed and cannot be turned off. Each toggle is
// saved in one PATCH so a half-applied preference set cannot exist.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import type { NotificationPrefs } from "@/types/domain";

export function NotificationPreferencesForm({ initial }: { readonly initial: NotificationPrefs }) {
  const { toast } = useToast();
  const [values, setValues] = useState<NotificationPrefs>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof NotificationPrefs, checked: boolean) {
    setValues((current) => ({ ...current, [key]: checked }));
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Your preferences could not be saved.");
        return;
      }

      toast({ title: "Email preferences saved", tone: "success" });
    } catch {
      setError("Your preferences could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Switch
        label="Important competition emails"
        description="Entry confirmations, completed draws, published fixtures, knockout qualification and tournament completion. On by default."
        checked={values.important}
        onCheckedChange={(checked) => update("important", checked)}
      />
      <Switch
        label="Result emails"
        description="A short message when a result is recorded or a result report you filed is reviewed. Off by default."
        checked={values.resultEmails}
        onCheckedChange={(checked) => update("resultEmails", checked)}
      />
      <Switch
        label="Announcement emails"
        description="Platform and tournament announcements. Off by default."
        checked={values.announcementEmails}
        onCheckedChange={(checked) => update("announcementEmails", checked)}
      />

      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-grey-400">
        Critical account and security email — approval decisions, account status, a cancelled
        tournament you entered and email-change notices — is always sent and cannot be turned off.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-danger-soft">
          {error}
        </p>
      ) : null}

      <Button onClick={() => void save()} loading={saving} loadingLabel="Saving preferences">
        Save preferences
      </Button>
    </div>
  );
}
