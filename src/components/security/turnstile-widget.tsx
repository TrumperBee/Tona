"use client";

// GCC - Cloudflare Turnstile widget.
//
// The site key is public. The token is verified on the server; this component
// only renders the challenge and reports the token. It stays usable on small
// screens (the widget scales down and sits above the submit button).
import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

interface TurnstileOptions {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

interface TurnstileApi {
  render: (element: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileWidgetProps {
  readonly action: string;
  readonly onToken: (token: string | null) => void;
  readonly className?: string;
}

export function TurnstileWidget({ action, onToken, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const elementId = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const e2eBypass = process.env.NEXT_PUBLIC_GCC_E2E === "1";

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (e2eBypass) {
      onTokenRef.current("e2e-turnstile-bypass");
      return;
    }
    if (!siteKey) {
      onTokenRef.current(null);
      return;
    }

    if (!scriptLoaded || !window.turnstile || !containerRef.current) {
      return;
    }

    const id = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      size: "flexible",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });

    widgetId.current = id;

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [action, e2eBypass, scriptLoaded, siteKey]);

  if (e2eBypass) {
    return <div data-testid="turnstile-e2e-bypass" className={className} />;
  }

  if (!siteKey) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return (
      <p
        className={`rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-grey-400 ${className ?? ""}`}
      >
        Turnstile is not configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to
        enable the security check.
      </p>
    );
  }

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} id={`turnstile-${elementId.replace(/:/g, "")}`} />
    </div>
  );
}
