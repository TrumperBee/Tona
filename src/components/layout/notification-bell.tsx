"use client";

// GCC - header notification bell.
//
// The server supplies an exact unread count and the five newest notifications.
// The panel only navigates and links to the full inbox; read-state changes go
// through the inbox route.
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { NotificationBellData } from "@/lib/notifications/types";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export function NotificationBell({
  data,
  inboxHref = "/dashboard/notifications",
}: {
  readonly data: NotificationBellData;
  readonly inboxHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const count = data.unreadCount > 99 ? "99+" : String(data.unreadCount);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          data.unreadCount > 0 ? `Notifications, ${data.unreadCount} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-grey-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {data.unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-electric-500 px-1 text-[10px] font-bold leading-5 text-navy-950">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-navy-900 shadow-card">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              Notifications
            </p>
            {data.unreadCount > 0 ? (
              <span className="text-[11px] font-semibold text-electric-300">
                {data.unreadCount} unread
              </span>
            ) : null}
          </div>

          {data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-grey-400">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-white/10 overflow-y-auto">
              {data.items.map((item) => {
                const content = (
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm",
                        item.read ? "text-grey-300" : "font-semibold text-white",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-grey-500">
                      {item.body}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-eyebrow text-grey-600">
                      {item.createdAt ? formatDateTime(item.createdAt) : ""}
                    </p>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-white/[0.05]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-white/10 px-4 py-3">
            <Link
              href={inboxHref}
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-electric-300 hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
