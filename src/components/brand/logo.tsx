// GCC - original brand mark and lockup.
//
// The mark is a circuit orbit drawn as a G: a near-complete ring, a pitch
// crossbar and a gold node that marks the champion. It contains no trophy,
// star, shield or borrowed football-competition mark.
import { cn } from "@/lib/utils/cn";

type BrandTone = "light" | "dark";

interface BrandMarkProps {
  readonly className?: string;
  readonly tone?: BrandTone;
}

export function BrandMark({ className, tone = "light" }: BrandMarkProps) {
  const orbit = tone === "light" ? "#56B8FF" : "#157BE8";
  const bar = tone === "light" ? "#FFFFFF" : "#0A1B33";
  const node = tone === "light" ? "#F5C443" : "#E0A82E";
  const inner = tone === "light" ? "#FFFFFF" : "#0A1B33";

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={cn("h-10 w-10", className)}
    >
      <circle
        cx="32"
        cy="32"
        r="10"
        fill="none"
        stroke={inner}
        strokeOpacity="0.22"
        strokeWidth="1.6"
      />
      <path
        d="M49.2 20A21 21 0 1 0 49.2 44"
        fill="none"
        stroke={orbit}
        strokeWidth="6.5"
        strokeLinecap="square"
      />
      <path d="M49.2 32V44" fill="none" stroke={orbit} strokeWidth="6.5" strokeLinecap="square" />
      <path d="M32 32H49.2" fill="none" stroke={bar} strokeWidth="6.5" strokeLinecap="square" />
      <circle cx="49.2" cy="32" r="4" fill={node} />
    </svg>
  );
}

interface BrandLockupProps {
  readonly className?: string;
  readonly markClassName?: string;
  readonly tone?: BrandTone;
  readonly compact?: boolean;
  readonly tagline?: boolean;
  readonly descriptor?: boolean;
}

export function BrandLockup({
  className,
  markClassName,
  tone = "light",
  compact = false,
  tagline = false,
  descriptor = true,
}: BrandLockupProps) {
  const text = tone === "light" ? "text-white" : "text-navy-950";
  const muted = tone === "light" ? "text-grey-400" : "text-navy-600";
  const accent = tone === "light" ? "text-electric-300" : "text-electric-700";

  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandMark tone={tone} className={cn("h-9 w-9 shrink-0", markClassName)} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className={cn("font-display text-xl font-semibold uppercase tracking-display", text)}>
          {compact ? "GCC" : "Global Champions Circuit"}
        </span>
        {descriptor ? (
          <span
            className={cn(
              "mt-1 hidden text-[10px] font-semibold uppercase tracking-eyebrow sm:block",
              accent,
            )}
          >
            {compact ? "Global Champions Circuit" : "One Platform. Endless Competition."}
          </span>
        ) : null}
        {tagline && !descriptor ? (
          <span className={cn("mt-1 text-[10px] uppercase tracking-eyebrow", muted)}>
            One Platform. Endless Competition.
          </span>
        ) : null}
      </span>
    </span>
  );
}
