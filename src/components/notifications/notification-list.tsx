"use client";

// GCC - notification inbox controls.
//
// The server owns pagination and queries. This component groups rows by UTC day,
// renders a type icon, marks items read individually or all at once and uses
// Next links so every deep link is client-navigated. A link click also marks the
// notification read with a keepalive request, so navigation cannot cancel it.
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Flag,
  Megaphone,
  Settings,
  ShieldAlert,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { NotificationType } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const TYPE_ICONS: Readonly<Record<NotificationType, LucideIcon>> = {
  system: ShieldAlert,
  tournament: Trophy,
  fixture: CalendarDays,
  result: Swords,
  result_report: Flag,
  announcement: Megaphone,
  application: ClipboardList,
};

export interface NotificationInboxItem {
  readonly id: string;
  readonly type: NotificationType;
  readonly kind: string | null;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string | null;
}

interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly NotificationInboxItem[];
}

function dayKey(item: NotificationInboxItem): string {
  return item.createdAt ? item.createdAt.slice(0, 10) : "unknown";
}

function dayLabel(key: string, today: string): string {
  if (key === "unknown") return "Earlier";
  if (key === today) return "Today";

  const yesterday = new Date(`${today}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  if (key === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return formatDate(`${key}T00:00:00.000Z`);
}

function groupByDay(items: readonly NotificationInboxItem[], today: string): readonly DayGroup[] {
  const groups = new Map<string, NotificationInboxItem[]>();

  for (const item of items) {
    const key = dayKey(item);
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    label: dayLabel(key, today),
    items: groupItems,
  }));
}

export function NotificationList({
  items: initialItems,
  today,
}: {
  readonly items: readonly NotificationInboxItem[];
  readonly today: string;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<readonly NotificationInboxItem[]>(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.read).length;
  const groups = groupByDay(items, today);

  async function markRead(id: string, options: { readonly silent?: boolean } = {}) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
        keepalive: true,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "The notification could not be marked as read.");
        return;
      }

      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );

      if (!options.silent) {
        toast({ title: "Notification marked as read", tone: "success" });
      }
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-grey-400">
          {unread > 0 ? `${unread} unread` : "Everything here is read."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/notifications/settings"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-grey-300 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
            Email settings
          </Link>
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
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-soft">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
              {group.label}
            </h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-navy-900/60">
              {group.items.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? Bell;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-wrap items-start gap-4 border-l-2 p-4 sm:p-5",
                      item.read
                        ? "border-l-transparent"
                        : "border-l-electric-400 bg-electric-500/[0.04]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                        item.read
                          ? "border-white/10 bg-white/[0.03] text-grey-400"
                          : "border-electric-400/30 bg-electric-500/10 text-electric-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

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
                          <span className="rounded-full bg-electric-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-eyebrow text-electric-300">
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
                          <Link
                            href={item.link}
                            onClick={() => {
                              if (!item.read) void markRead(item.id, { silent: true });
                            }}
                            className="font-semibold text-electric-300 hover:underline"
                          >
                            Open
                          </Link>
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
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
