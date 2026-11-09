"use client";

// GCC - platform announcement manager.
//
// Create, edit, publish, unpublish and soft-delete. Every write goes through a
// server route; this component never touches Firestore directly.
import { Pencil, Pin, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/data-display";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import type { AnnouncementSeverity } from "@/types/domain";

export interface AnnouncementItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly severity: AnnouncementSeverity;
  readonly pinned: boolean;
  readonly publishedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string | null;
}

interface FormState {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  pinned: boolean;
  expiresAt: string;
  publishNow: boolean;
}

const emptyForm: FormState = {
  title: "",
  body: "",
  severity: "info",
  pinned: false,
  expiresAt: "",
  publishNow: true,
};

function localDateTimeValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isExpired(item: AnnouncementItem): boolean {
  return item.expiresAt !== null && new Date(item.expiresAt).getTime() <= Date.now();
}

function formFromItem(item: AnnouncementItem): FormState {
  return {
    title: item.title,
    body: item.body,
    severity: item.severity,
    pinned: item.pinned,
    expiresAt: localDateTimeValue(item.expiresAt),
    publishNow: item.publishedAt !== null,
  };
}

export function AnnouncementManager({ items }: { readonly items: readonly AnnouncementItem[] }) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError(null);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setError(null);
    setEditorOpen(true);
  }

  function openEdit(item: AnnouncementItem) {
    setEditing(item);
    setForm(formFromItem(item));
    setFieldErrors({});
    setError(null);
    setEditorOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      title: form.title,
      body: form.body,
      severity: form.severity,
      pinned: form.pinned,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      ...(editing ? {} : { publishNow: form.publishNow }),
    };

    try {
      const response = await fetch(
        editing
          ? `/api/super-admin/announcements/${encodeURIComponent(editing.id)}`
          : "/api/super-admin/announcements",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok) {
        setError(result.error ?? "The announcement could not be saved.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setEditorOpen(false);
      setNotice(editing ? "Announcement updated." : "Announcement created.");
      router.refresh();
    } catch {
      setError("The announcement could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changePublished(item: AnnouncementItem, publish: boolean) {
    setBusyId(item.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/super-admin/announcements/${encodeURIComponent(item.id)}/${
          publish ? "publish" : "unpublish"
        }`,
        { method: "POST" },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setNotice(result.error ?? "The announcement could not be updated.");
        return;
      }

      setNotice(publish ? "Announcement published." : "Announcement unpublished.");
      router.refresh();
    } catch {
      setNotice("The announcement could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const response = await fetch(
        `/api/super-admin/announcements/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setNotice(result.error ?? "The announcement could not be deleted.");
        return;
      }

      setDeleteTarget(null);
      setNotice("Announcement deleted.");
      router.refresh();
    } catch {
      setNotice("The announcement could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {notice ? (
          <p role="status" className="text-sm text-grey-300">
            {notice}
          </p>
        ) : (
          <p className="text-sm text-grey-400">
            Published announcements appear on the public site. Deletion is a soft delete.
          </p>
        )}
        <Button leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={openCreate}>
          New announcement
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No announcements yet"
          description="Create the first platform announcement. Nothing is shown publicly until it is published."
          action={<Button onClick={openCreate}>Write an announcement</Button>}
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const expired = isExpired(item);
            const published = item.publishedAt !== null && !expired;

            return (
              <li key={item.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.severity === "important" ? "danger" : "info"}>
                          {item.severity === "important" ? "Important" : "Info"}
                        </Badge>
                        <Badge tone={published ? "success" : expired ? "warning" : "neutral"}>
                          {expired ? "Expired" : published ? "Published" : "Draft"}
                        </Badge>
                        {item.pinned ? (
                          <Badge tone="gold">
                            <Pin aria-hidden="true" className="h-3 w-3" />
                            Pinned
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-display text-xl font-semibold uppercase tracking-display text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-grey-400">
                        {item.body}
                      </p>
                      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-grey-500">
                        <div>
                          <dt className="inline font-semibold text-grey-400">Published: </dt>
                          <dd className="inline">{formatDate(item.publishedAt)}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-grey-400">Expires: </dt>
                          <dd className="inline">{formatDate(item.expiresAt)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />}
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      {item.publishedAt === null || expired ? (
                        <Button
                          size="sm"
                          loading={busyId === item.id}
                          loadingLabel="Publishing"
                          leftIcon={<Send aria-hidden="true" className="h-3.5 w-3.5" />}
                          onClick={() => void changePublished(item, true)}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busyId === item.id}
                          loadingLabel="Unpublishing"
                          leftIcon={<Undo2 aria-hidden="true" className="h-3.5 w-3.5" />}
                          onClick={() => void changePublished(item, false)}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                        onClick={() => setDeleteTarget(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setEditorOpen(false);
        }}
        title={editing ? "Edit announcement" : "New announcement"}
        description="Plain text with line breaks. Published announcements are public immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} loadingLabel="Saving" onClick={() => void submit()}>
              {editing ? "Save changes" : form.publishNow ? "Create and publish" : "Save draft"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
            >
              {error}
            </div>
          ) : null}

          <FormField
            htmlFor="announcement-title"
            label="Title"
            hint={`${form.title.length}/100 characters.`}
            error={fieldErrors.title}
          >
            <Input
              id="announcement-title"
              value={form.title}
              maxLength={100}
              onChange={(event) => update("title", event.currentTarget.value)}
            />
          </FormField>

          <FormField
            htmlFor="announcement-body"
            label="Body"
            hint={`${form.body.length}/2000 characters. Line breaks are preserved.`}
            error={fieldErrors.body}
          >
            <Textarea
              id="announcement-body"
              value={form.body}
              rows={7}
              maxLength={2000}
              onChange={(event) => update("body", event.currentTarget.value)}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              htmlFor="announcement-severity"
              label="Severity"
              error={fieldErrors.severity}
            >
              <Select
                id="announcement-severity"
                value={form.severity}
                onChange={(event) =>
                  update("severity", event.currentTarget.value as AnnouncementSeverity)
                }
              >
                <option value="info">Info</option>
                <option value="important">Important</option>
              </Select>
            </FormField>

            <FormField
              htmlFor="announcement-expiry"
              label="Expires"
              optional
              hint="Leave empty for no expiry. The banner hides after this time."
              error={fieldErrors.expiresAt}
            >
              <Input
                id="announcement-expiry"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => update("expiresAt", event.currentTarget.value)}
              />
            </FormField>
          </div>

          <Switch
            label="Pin to the top of the banner"
            description="Pinned announcements are shown first where space allows."
            checked={form.pinned}
            onCheckedChange={(checked) => update("pinned", checked)}
          />

          {!editing ? (
            <Switch
              label="Publish immediately"
              description="Turn off to save a draft that is not public."
              checked={form.publishNow}
              onCheckedChange={(checked) => update("publishNow", checked)}
            />
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Delete this announcement?"
        description="The announcement is soft-deleted and disappears from the public site. The record is retained for the audit history."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              loadingLabel="Deleting"
              onClick={() => void remove()}
            >
              Delete announcement
            </Button>
          </>
        }
      >
        <p className="text-sm text-grey-300">
          {deleteTarget ? `“${deleteTarget.title}”` : "This announcement"} will no longer be
          visible.
        </p>
      </Dialog>
    </div>
  );
}
