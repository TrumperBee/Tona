"use client";

// GCC - site-wide announcement banners.
//
// Dismissal is stored in a first-party cookie, which the server reads before
// rendering, so the banner is part of the first paint and never appears late.
// Pinned items are ordered first by the server.
import { Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { rememberDismissedAnnouncement } from "@/lib/announcements/dismissal";
import { cn } from "@/lib/utils/cn";
import type { AnnouncementSeverity } from "@/types/domain";

export interface BannerAnnouncement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly severity: AnnouncementSeverity;
  readonly pinned: boolean;
}

export function AnnouncementBanner({
  announcements,
}: {
  readonly announcements: readonly BannerAnnouncement[];
}) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  function dismiss(id: string) {
    setDismissed((current) => new Set(current).add(id));

    try {
      rememberDismissedAnnouncement(id);
    } catch {
      // Storage can be blocked; hiding it for this page view is still correct.
    }
  }

  const visible = announcements.filter((item) => !dismissed.has(item.id));

  if (visible.length === 0) {
    return null;
  }

  return (
    <div aria-label="Platform announcements" className="border-b border-white/10">
      <div className="container space-y-2 py-3">
        {visible.map((item) => (
          <div
            key={item.id}
            role="region"
            aria-label={item.title}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              item.severity === "important"
                ? "border-danger/40 bg-danger/10"
                : "border-electric-400/30 bg-electric-500/10",
            )}
          >
            <Megaphone
              aria-hidden="true"
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.severity === "important" ? "text-danger-soft" : "text-electric-300",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {item.title}
                {item.pinned ? (
                  <span className="ml-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-eyebrow text-gold-200">
                    Pinned
                  </span>
                ) : null}
              </p>
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-grey-300">
                {item.body}
              </p>
              <Link
                href="/announcements"
                className="mt-1 inline-block text-xs font-semibold text-electric-300 underline-offset-4 hover:underline"
              >
                All announcements
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={`Dismiss announcement: ${item.title}`}
              className="rounded p-1 text-grey-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
