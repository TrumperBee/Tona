"use client";

// GCC - platform settings form.
//
// Maintenance and registration toggles require an explicit confirmation. The
// server re-validates everything, requires a reason when maintenance changes and
// writes the before/after values to the audit log.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

export interface SettingsFormValues {
  readonly maintenanceMode: boolean;
  readonly maintenanceMessage: string;
  readonly registrationsOpen: boolean;
  readonly maxActiveTournamentsPerOrganiser: number;
  readonly applicationCooldownDays: number;
}

export interface SettingsFormProps {
  readonly initial: SettingsFormValues;
}

interface ApiError {
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const refresh = useRefreshPreservingScroll();
  const { toast } = useToast();
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const maintenanceChanged = values.maintenanceMode !== baseline.maintenanceMode;
  const registrationsChanged = values.registrationsOpen !== baseline.registrationsOpen;
  const needsConfirmation = maintenanceChanged || registrationsChanged;

  function update<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSuccess(null);
    setError(null);
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (values.maintenanceMode && values.maintenanceMessage.trim().length < 5) {
      nextErrors.maintenanceMessage =
        "Write a message of at least 5 characters for the maintenance banner.";
    }

    if (values.maintenanceMessage.length > 300) {
      nextErrors.maintenanceMessage = "Use 300 characters or fewer.";
    }

    if (
      !Number.isInteger(values.maxActiveTournamentsPerOrganiser) ||
      values.maxActiveTournamentsPerOrganiser < 1 ||
      values.maxActiveTournamentsPerOrganiser > 20
    ) {
      nextErrors.maxActiveTournamentsPerOrganiser = "Use a whole number from 1 to 20.";
    }

    if (
      !Number.isInteger(values.applicationCooldownDays) ||
      values.applicationCooldownDays < 0 ||
      values.applicationCooldownDays > 90
    ) {
      nextErrors.applicationCooldownDays = "Use a whole number from 0 to 90.";
    }

    if (maintenanceChanged && reason.trim().length < 5) {
      nextErrors.reason = "Give a reason of at least 5 characters for changing maintenance mode.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (!validate()) {
      setConfirmOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/super-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          maintenanceMessage: values.maintenanceMessage.trim(),
          reason: reason.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(payload.error ?? "The settings could not be saved.");
        setFieldErrors(payload.fieldErrors ?? {});
        setConfirmOpen(false);
        return;
      }

      setBaseline(values);
      setReason("");
      setConfirmOpen(false);
      setSuccess("Platform settings saved and audited.");
      toast({ title: "Settings saved", tone: "success" });
      refresh();
    } catch {
      setError("The settings could not be saved. Check your connection and try again.");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (needsConfirmation) {
      if (!validate()) return;
      setConfirmOpen(true);
      return;
    }

    void save();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-soft"
          >
            {success}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Switch
              label="Maintenance mode"
              description="Non-Super-Admin writes are rejected with HTTP 503 while this is on. The message below is shown in the site banner."
              checked={values.maintenanceMode}
              onCheckedChange={(checked) => update("maintenanceMode", checked)}
            />

            <FormField
              htmlFor="maintenance-message"
              label="Maintenance message"
              hint={`${values.maintenanceMessage.length}/300 characters. Shown publicly when maintenance mode is on.`}
              error={fieldErrors.maintenanceMessage}
            >
              <Textarea
                id="maintenance-message"
                value={values.maintenanceMessage}
                maxLength={300}
                rows={3}
                placeholder="GCC is briefly offline while we deploy an update. Please check back shortly."
                onChange={(event) => update("maintenanceMessage", event.currentTarget.value)}
              />
            </FormField>

            <Switch
              label="Registrations open"
              description="When off, /api/auth/register rejects new accounts with a clear message."
              checked={values.registrationsOpen}
              onCheckedChange={(checked) => update("registrationsOpen", checked)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organiser limits</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              htmlFor="max-active-tournaments"
              label="Max active tournaments per organiser"
              hint="1 to 20. Used by the organiser console from Phase 6."
              error={fieldErrors.maxActiveTournamentsPerOrganiser}
            >
              <Input
                id="max-active-tournaments"
                type="number"
                min={1}
                max={20}
                step={1}
                value={values.maxActiveTournamentsPerOrganiser}
                onChange={(event) =>
                  update("maxActiveTournamentsPerOrganiser", Number(event.currentTarget.value))
                }
              />
            </FormField>

            <FormField
              htmlFor="application-cooldown"
              label="Application cooldown (days)"
              hint="0 to 90 days. Used by the organiser application flow from Phase 6."
              error={fieldErrors.applicationCooldownDays}
            >
              <Input
                id="application-cooldown"
                type="number"
                min={0}
                max={90}
                step={1}
                value={values.applicationCooldownDays}
                onChange={(event) =>
                  update("applicationCooldownDays", Number(event.currentTarget.value))
                }
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit reason</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              htmlFor="settings-reason"
              label="Reason for this change"
              optional={!maintenanceChanged}
              hint="Required when maintenance mode is switched on or off. Stored in the audit log."
              error={fieldErrors.reason}
            >
              <Textarea
                id="settings-reason"
                value={reason}
                rows={3}
                maxLength={300}
                placeholder="Why are these settings changing?"
                onChange={(event) => {
                  setReason(event.currentTarget.value);
                  setSuccess(null);
                }}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} loadingLabel="Saving settings">
            Save settings
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm platform change"
        description={[
          maintenanceChanged
            ? `Maintenance mode will be ${values.maintenanceMode ? "turned ON" : "turned OFF"}.`
            : null,
          registrationsChanged
            ? `Registrations will be ${values.registrationsOpen ? "opened" : "closed"}.`
            : null,
          "This is written to the audit log and takes effect immediately.",
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel="Save changes"
        tone="primary"
        loading={saving}
        onConfirm={() => void save()}
      />
    </>
  );
}
