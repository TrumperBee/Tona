"use client";

// GCC - notification inbox controls.
//
// The server page owns pagination and queries. This component only marks the
// owner's notifications as read through the server route and refreshes.
import { CheckCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { NotificationType } from "@/types/domain";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export interface NotificationInboxItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string | null;
}

export function NotificationList({
  items: initialItems,
}: {
  readonly items: readonly NotificationInboxItem[];
  readonly unread: number;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<readonly NotificationInboxItem[]>(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.read).length;

  async function markRead(id: string) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "The notification could not be marked as read.");
        return;
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      toast({ title: "Notification marked as read", tone: "success" });
    } catch {
      setError("The notification could not be marked as read. Check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Notifications could not be marked as read.");
        return;
      }

      setItems((current) => current.map((item) => ({ ...item, read: true })));
      toast({ title: "All notifications marked as read", tone: "success" });
    } catch {
      setError("Notifications could not be marked as read. Check your connection.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-grey-400">
          {unread > 0 ? `${unread} unread` : "Everything here is read."}
        </p>
        {unread > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            loading={markingAll}
            loadingLabel="Marking"
            onClick={() => void markAllRead()}
          >
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
            Mark all as read
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-soft">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-navy-900/60">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex flex-wrap items-start gap-4 border-l-2 p-4 sm:p-5",
              item.read ? "border-l-transparent" : "border-l-electric-400 bg-electric-500/[0.04]",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm",
                    item.read ? "font-medium text-grey-200" : "font-semibold text-white",
                  )}
                >
                  {item.title}
                </p>
                {!item.read ? (
                  <span className="rounded-full bg-electric-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-eyebrow text-electric-300">
                    Unread
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-grey-400">
                {item.body}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-grey-500">
                {item.createdAt ? <span>{formatDateTime(item.createdAt)}</span> : null}
                {item.link ? (
                  <a href={item.link} className="font-semibold text-electric-300 hover:underline">
                    Open
                  </a>
                ) : null}
              </div>
            </div>

            {!item.read ? (
              <Button
                variant="ghost"
                size="sm"
                loading={busyId === item.id}
                loadingLabel="Marking"
                onClick={() => void markRead(item.id)}
              >
                Mark read
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
