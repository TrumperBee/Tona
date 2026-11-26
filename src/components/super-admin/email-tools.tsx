"use client";

// GCC - Super Admin email controls.
//
// Two actions only: send one test message to the Super Admin's own address, and
// switch announcement email on or off. The server re-checks the monthly
// reference before enabling the switch.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

interface ApiError {
  readonly error?: string;
}

export function EmailTools({
  initialEmailAnnouncements,
  announcementRecipients,
  remainingNormal,
}: {
  readonly initialEmailAnnouncements: boolean;
  readonly announcementRecipients: number;
  readonly remainingNormal: number;
}) {
  const refresh = useRefreshPreservingScroll();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEmailAnnouncements);
  const [savingToggle, setSavingToggle] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  async function toggle(checked: boolean) {
    setSavingToggle(true);
    setToggleError(null);

    try {
      const response = await fetch("/api/super-admin/email/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAnnouncements: checked }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiError & {
        emailAnnouncements?: boolean;
      };

      if (!response.ok) {
        setToggleError(payload.error ?? "The switch could not be changed.");
        return;
      }

      setEnabled(payload.emailAnnouncements === true);
      toast({
        title: payload.emailAnnouncements
          ? "Announcement email enabled"
          : "Announcement email disabled",
        tone: "success",
      });
      refresh();
    } catch {
      setToggleError("The switch could not be changed. Check your connection and try again.");
    } finally {
      setSavingToggle(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setTestError(null);

    try {
      const response = await fetch("/api/super-admin/email/test", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as ApiError & {
        simulated?: boolean;
      };

      if (!response.ok) {
        setTestError(payload.error ?? "The test message could not be sent.");
        return;
      }

      toast({
        title: payload.simulated
          ? "Test rendered locally (email is not configured)"
          : "Test email sent to the Super Admin address",
        tone: "success",
      });
    } catch {
      setTestError("The test message could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Send a test email</CardTitle>
          <CardDescription>
            Goes to the signed-in Super Admin only. Uses the same sender, reply-to and quota path as
            real notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testError ? (
            <p role="alert" className="text-sm text-danger-soft">
              {testError}
            </p>
          ) : null}
          <Button onClick={() => void sendTest()} loading={sending} loadingLabel="Sending test">
            Send test email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Announcement email</CardTitle>
          <CardDescription>
            When on, publishing an announcement also emails users who opted in. Enabling is refused
            once the monthly reference is reached.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch
            label="Email platform announcements"
            description="Critical account mail is unaffected by this switch."
            checked={enabled}
            disabled={savingToggle}
            onCheckedChange={(checked) => void toggle(checked)}
          />
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-grey-400">
            {announcementRecipients} opted-in {announcementRecipients === 1 ? "user" : "users"}{" "}
            would receive the next announcement (up to 900). {remainingNormal} normal{" "}
            {remainingNormal === 1 ? "send remains" : "sends remain"} in today&rsquo;s budget; a
            broadcast that needs more is refused rather than half-sent.
          </p>
          {toggleError ? (
            <p role="alert" className="text-sm text-danger-soft">
              {toggleError}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
