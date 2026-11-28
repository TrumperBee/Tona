"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [reference, setReference] = useState<string | null>(error.digest ?? null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message?.slice(0, 500) ?? "Global client error",
        digest: error.digest,
        name: error.name,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { reference?: string }) : null))
      .then((body) => {
        if (!cancelled && body?.reference) setReference(body.reference);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0b1220",
          color: "#fff",
        }}
      >
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 560, textAlign: "center" }}>
            <p
              style={{
                color: "#f0b429",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Something went wrong
            </p>
            <h1 style={{ fontSize: 36, margin: "12px 0" }}>GCC could not load this page</h1>
            <p style={{ color: "#c7d2e0", lineHeight: 1.6 }}>
              An unexpected error occurred. No competition data has been changed. Try again, or
              return home.
            </p>
            {reference ? (
              <p style={{ color: "#8ea0b8", fontFamily: "monospace", fontSize: 12 }}>
                Reference: {reference}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                onClick={reset}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: 0,
                  background: "#2b6cb0",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Try again
              </button>
              <button
                onClick={() => router.push("/")}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #355070",
                  color: "#fff",
                  background: "transparent",
                }}
              >
                Home
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
