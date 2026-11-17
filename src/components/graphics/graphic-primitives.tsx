"use client";

// GCC - shared visual primitives for fixed-size graphic templates.
//
// Every dimension is expressed in export pixels, never Tailwind breakpoints:
// a template renders identically in the preview, in jsdom and in the captured
// PNG. Avatars fall back to initials when the source is missing, blocked or
// fails to load, so a PNG never contains a broken image icon.
import { useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand/logo";
import { GRAPHIC_SIZES, type GraphicBranding, type GraphicSizeId } from "@/lib/graphics/types";
import { truncateGamerTag } from "@/lib/graphics/data";
import { initialsFor } from "@/components/ui/data-display";
import { cn } from "@/lib/utils/cn";
import { createContext, useContext } from "react";

const BlockedImagesContext = createContext<ReadonlySet<string>>(new Set());

export function GraphicImageProvider({
  blocked,
  children,
}: {
  readonly blocked: ReadonlySet<string>;
  readonly children: ReactNode;
}) {
  return <BlockedImagesContext.Provider value={blocked}>{children}</BlockedImagesContext.Provider>;
}

function isBlocked(src: string | null, blocked: ReadonlySet<string>): boolean {
  return src !== null && blocked.has(src);
}

export function GraphicAvatar({
  name,
  src,
  size,
  className,
  ring = "border-white/20",
}: {
  readonly name: string;
  readonly src: string | null;
  readonly size: number;
  readonly className?: string;
  readonly ring?: string;
}) {
  const blocked = useContext(BlockedImagesContext);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src !== null && !isBlocked(src, blocked) && failedSrc !== src;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-navy-800 font-display font-semibold uppercase text-electric-200",
        ring,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.34)) }}
    >
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          width={size}
          height={size}
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
    </span>
  );
}

export function GraphicTag({
  tag,
  className,
  maxLength = 16,
}: {
  readonly tag: string;
  readonly className?: string;
  readonly maxLength?: number;
}) {
  return (
    <span className={cn("block truncate", className)} title={tag}>
      {truncateGamerTag(tag, maxLength)}
    </span>
  );
}

/** Tournament logo when present, otherwise the GCC mark. */
export function GraphicLogo({
  branding,
  size = 56,
}: {
  readonly branding: GraphicBranding;
  readonly size?: number;
}) {
  const blocked = useContext(BlockedImagesContext);
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(branding.logoSrc) && !failed && !isBlocked(branding.logoSrc, blocked);

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.logoSrc ?? ""}
        alt=""
        crossOrigin="anonymous"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-xl border border-white/20 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return <BrandMark tone="light" className="h-14 w-14 shrink-0" />;
}

export function GraphicFrame({
  branding,
  size,
  children,
  footerNote,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly children: ReactNode;
  readonly footerNote?: string;
}) {
  const dimensions = GRAPHIC_SIZES[size];
  const blocked = useContext(BlockedImagesContext);
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover =
    Boolean(branding.coverSrc) && !coverFailed && !isBlocked(branding.coverSrc, blocked);

  return (
    <div
      className="relative flex flex-col overflow-hidden bg-navy-950 font-sans text-white"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-glow"
        style={{ opacity: 0.9 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-pitch-grid bg-grid opacity-[0.55]"
      />
      {showCover ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.coverSrc ?? ""}
            alt=""
            crossOrigin="anonymous"
            onError={() => setCoverFailed(true)}
            className="h-full w-full object-cover opacity-[0.13]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/50 via-navy-950/80 to-navy-950" />
        </div>
      ) : null}

      <header
        className="relative z-10 flex items-start justify-between gap-6"
        style={{ padding: "52px 64px 0" }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <GraphicLogo branding={branding} />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold uppercase tracking-[0.18em] text-electric-300">
              {branding.siteName}
            </p>
            <h1 className="mt-2 break-words font-display text-[36px] font-semibold uppercase leading-[1.04] tracking-display text-white">
              {branding.tournamentName}
            </h1>
            <p className="mt-2 text-[18px] font-medium text-grey-400">
              {[branding.season, branding.gameName].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {branding.organiserName ? (
          <div className="shrink-0 text-right">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-grey-500">
              Organised by
            </p>
            <p className="mt-1 max-w-[280px] truncate text-[18px] font-semibold text-grey-200">
              {branding.organiserName}
            </p>
          </div>
        ) : null}
      </header>

      <main
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{ padding: "34px 64px 0" }}
      >
        {children}
      </main>

      <footer
        className="relative z-10 flex items-center justify-between gap-6 border-t border-white/10"
        style={{ padding: "24px 64px 38px" }}
      >
        <span className="text-[16px] font-semibold uppercase tracking-[0.16em] text-grey-400">
          {footerNote ?? branding.tagline}
        </span>
        <span className="text-[16px] font-medium text-electric-300">{branding.siteUrl}</span>
      </footer>
    </div>
  );
}

export function GraphicSectionTitle({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string | null;
}) {
  return (
    <div className="mb-5">
      <p className="text-[15px] font-semibold uppercase tracking-[0.2em] text-gold-300">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-[38px] font-semibold uppercase leading-none tracking-display text-white">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-[17px] leading-6 text-grey-400">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * Original champion motif: a cup silhouette built from a bowl, two handles and
 * a base. It is deliberately geometric and shares no form with any real
 * competition trophy.
 */
export function GraphicTrophy({ size = 180 }: { readonly size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="gcc-trophy-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#F5C443" />
          <stop offset="100%" stopColor="#C08A1B" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="none" stroke="#56B8FF" strokeOpacity="0.25" />
      <circle cx="60" cy="60" r="43" fill="none" stroke="#56B8FF" strokeOpacity="0.14" />
      <path d="M35 24h50v17c0 16-11 29-25 29S35 57 35 41V24Z" fill="url(#gcc-trophy-gold)" />
      <path
        d="M35 31H24c0 13 8 20 18 21M85 31h11c0 13-8 20-18 21"
        fill="none"
        stroke="#F5C443"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M55 70h10v17H55z" fill="#F5C443" />
      <path d="M40 92h40v9H40z" fill="#F5C443" />
      <circle cx="60" cy="42" r="7" fill="#050F1F" fillOpacity="0.35" />
    </svg>
  );
}

/** White-backed QR block; exports cleanly because the image is a data URL. */
export function GraphicQr({
  src,
  size = 148,
  caption,
}: {
  readonly src: string;
  readonly size?: number;
  readonly caption?: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="rounded-xl bg-white p-3" style={{ width: size, height: size }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={size - 24} height={size - 24} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-center text-[12px] font-semibold text-navy-900">
            QR unavailable
          </span>
        )}
      </div>
      {caption ? (
        <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-grey-400">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export function GraphicChip({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "electric" | "gold";
}) {
  const tones = {
    neutral: "border-white/20 bg-white/[0.05] text-grey-200",
    electric: "border-electric-400/40 bg-electric-500/[0.12] text-electric-200",
    gold: "border-gold-400/40 bg-gold-400/[0.12] text-gold-200",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
