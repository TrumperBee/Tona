// GCC - tournament lifecycle stepper.
//
// Pure presentation: the seven lifecycle stages with done/current/locked
// states. Lock reasons are exposed through title attributes and screen-reader
// text so the exact unlock condition stays honest without cluttering the bar.
import { Check, Lock } from "lucide-react";

import type { WorkspaceStep } from "@/lib/tournament/workspace";
import { cn } from "@/lib/utils/cn";

export function WorkspaceStepper({ steps }: { readonly steps: readonly WorkspaceStep[] }) {
  return (
    <ol
      aria-label="Tournament lifecycle"
      className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:gap-0 sm:overflow-visible"
    >
      {steps.map((step, index) => {
        const isDone = step.state === "done";
        const isCurrent = step.state === "current";
        const isLocked = step.state === "locked";

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            title={isLocked ? (step.lockReason ?? undefined) : undefined}
            className="flex min-w-max flex-1 snap-start items-center gap-2 sm:flex-col sm:gap-0"
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                isDone && "border-success/50 bg-success/15 text-success-soft",
                isCurrent && "border-gold-400 bg-gold-400 text-navy-950",
                isLocked && "border-white/15 bg-navy-900 text-grey-500",
              )}
            >
              {isDone ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : isLocked ? (
                <Lock aria-hidden="true" className="h-3 w-3" />
              ) : (
                index + 1
              )}
            </span>

            <span className="sm:hidden">
              <span
                className={cn(
                  "block text-xs font-semibold uppercase tracking-eyebrow",
                  isCurrent ? "text-gold-200" : isDone ? "text-success-soft" : "text-grey-400",
                )}
              >
                {step.label}
              </span>
              {isLocked ? (
                <span className="block text-[10px] leading-4 text-grey-500">{step.lockReason}</span>
              ) : null}
            </span>

            <span className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1.5">
              <span
                className={cn(
                  "text-center text-[10px] font-semibold uppercase leading-3 tracking-eyebrow",
                  isCurrent ? "text-gold-200" : isDone ? "text-success-soft" : "text-grey-400",
                )}
              >
                {step.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 w-full rounded",
                  index === steps.length - 1
                    ? "bg-transparent sm:w-0"
                    : isDone
                      ? "bg-success/40"
                      : "bg-white/10",
                  index === 0 ? "sm:order-first" : "",
                )}
              />
            </span>

            {isLocked ? <span className="sr-only">Locked: {step.lockReason}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
