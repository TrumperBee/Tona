"use client";

// GCC - "Contact on WhatsApp" button and message sheet.
//
// The number never reaches this component as text. The preview request returns
// only the suggested message; the wa.me link is minted by the server when the
// player commits, and is opened in a new tab where WhatsApp asks them to press
// Send. Editing the text is allowed (max 500 characters) and the edited text is
// what the server puts in the link.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, TriangleAlert } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils/cn";

const MESSAGE_MAX_LENGTH = 500;

type PreviewState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly message: string }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "error"; readonly message: string };

export interface ContactWhatsAppButtonProps {
  readonly tournamentId: string;
  readonly matchId: string;
  readonly label?: string;
  readonly size?: "sm" | "md";
  readonly variant?: "primary" | "secondary" | "ghost";
  readonly className?: string;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ContactWhatsAppButton({
  tournamentId,
  matchId,
  label = "Contact on WhatsApp",
  size = "sm",
  variant = "secondary",
  className,
}: ContactWhatsAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const endpoint = `/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/contact`;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadPreview = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPreview({ status: "loading" });
    setSendError(null);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await readJson(response);

      if (controller.signal.aborted) {
        return;
      }

      if (response.status === 401) {
        setPreview({ status: "error", message: "Sign in to contact your opponent." });
        return;
      }

      if (!response.ok) {
        setPreview({
          status: "error",
          message:
            typeof body.error === "string"
              ? body.error
              : "Contact details could not be loaded. Try again.",
        });
        return;
      }

      if (body.available === false) {
        setPreview({
          status: "unavailable",
          reason:
            typeof body.reason === "string"
              ? body.reason
              : "Contact is unavailable for this match.",
        });
        return;
      }

      if (body.available === true && typeof body.message === "string") {
        setDraft(body.message.slice(0, MESSAGE_MAX_LENGTH));
        setPreview({ status: "ready", message: body.message });
        return;
      }

      setPreview({ status: "error", message: "Contact details could not be loaded. Try again." });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setPreview({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Contact details could not be loaded. Try again.",
      });
    }
  }, [endpoint]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setDraft("");
    setSendError(null);
    void loadPreview();
  }, [loadPreview]);

  const handleSend = useCallback(async () => {
    const message = draft.trim();

    if (message.length === 0) {
      setSendError("Write a message before opening WhatsApp.");
      return;
    }

    setSending(true);
    setSendError(null);

    // Opened synchronously so a desktop popup blocker does not swallow the tab
    // after the awaited request.
    const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = await readJson(response);

      if (!response.ok || typeof body.link !== "string") {
        tab?.close();
        setSendError(
          typeof body.error === "string" ? body.error : "WhatsApp could not be opened. Try again.",
        );
        return;
      }

      if (tab) {
        tab.opener = null;
        tab.location.href = body.link;
      } else {
        window.location.href = body.link;
      }

      setOpen(false);
    } catch {
      tab?.close();
      setSendError("WhatsApp could not be opened. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }, [draft, endpoint]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={buttonStyles({ variant, size, className })}
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        {label}
      </button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          if (!next && sending) {
            return;
          }
          setOpen(next);
        }}
        title="Contact on WhatsApp"
        description="The message opens in WhatsApp. Check it, then press Send yourself."
        footer={
          preview.status === "ready" ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSend()} disabled={sending}>
                {sending ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="h-4 w-4" />
                )}
                Open WhatsApp
              </Button>
            </div>
          ) : undefined
        }
      >
        {preview.status === "loading" ? (
          <p className="flex items-center gap-2 py-6 text-sm text-grey-400">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Preparing your message…
          </p>
        ) : null}

        {preview.status === "unavailable" ? (
          <div className="space-y-2 py-4">
            <p className="text-sm font-semibold text-white">Contact unavailable</p>
            <p className="text-sm leading-6 text-grey-400">{preview.reason}</p>
          </div>
        ) : null}

        {preview.status === "error" ? (
          <div className="space-y-3 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-danger">
              <TriangleAlert aria-hidden="true" className="h-4 w-4" />
              {preview.message}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadPreview()}>
              Try again
            </Button>
          </div>
        ) : null}

        {preview.status === "ready" ? (
          <div className="space-y-3">
            <label
              htmlFor="contact-message"
              className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400"
            >
              Your message
            </label>
            <textarea
              id="contact-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
              rows={6}
              maxLength={MESSAGE_MAX_LENGTH}
              className={cn(
                "w-full rounded-lg border border-white/15 bg-navy-950/60 px-3 py-2 text-sm leading-6 text-white",
                "focus-visible:border-electric-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400/40",
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grey-500">
              <span>You can edit this before sending.</span>
              <span className="tabular-nums">
                {draft.length}/{MESSAGE_MAX_LENGTH}
              </span>
            </div>
            {sendError ? (
              <p className="flex items-center gap-2 text-sm text-danger">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                {sendError}
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
