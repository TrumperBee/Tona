// GCC - account availability notice.
//
// Authentication is deliberately not implemented in Phase 3. These routes
// explain that clearly instead of showing a form that cannot submit.
import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonStyles } from "@/components/ui/button-styles";
import { Badge } from "@/components/ui/card";

export interface AuthNoticeProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly details?: readonly string[];
  readonly primaryAction?: { readonly href: string; readonly label: string };
  readonly secondaryAction?: { readonly href: string; readonly label: string };
  readonly tone?: "default" | "warning";
}

export function AuthNotice({
  eyebrow,
  title,
  description,
  details,
  primaryAction = { href: "/", label: "Back to home" },
  secondaryAction = { href: "/tournaments", label: "Browse tournaments" },
  tone = "default",
}: AuthNoticeProps) {
  return (
    <div>
      <span
        className={
          tone === "warning"
            ? "grid h-11 w-11 place-items-center rounded-lg border border-warning/30 bg-warning/10 text-warning-soft"
            : "grid h-11 w-11 place-items-center rounded-lg border border-electric-400/25 bg-electric-500/10 text-electric-300"
        }
      >
        <Lock aria-hidden="true" className="h-5 w-5" />
      </span>

      <p className="mt-5 text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase leading-tight tracking-display text-white">
        {title}
      </h1>
      <div className="mt-3 text-sm leading-6 text-grey-300">{description}</div>

      <div className="mt-5">
        <Badge tone="neutral">No form is open</Badge>
      </div>

      {details && details.length > 0 ? (
        <ul className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm text-grey-400">
          {details.map((detail) => (
            <li key={detail} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-electric-400"
              />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-7 flex flex-col gap-3">
        <Link href={primaryAction.href} className={buttonStyles({ className: "w-full" })}>
          {primaryAction.label}
        </Link>
        <Link
          href={secondaryAction.href}
          className={buttonStyles({ variant: "secondary", className: "w-full" })}
        >
          {secondaryAction.label}
        </Link>
      </div>
    </div>
  );
}
