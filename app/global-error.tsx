"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself (which
 * `app/error.tsx` cannot catch). Replaces the entire document, so it must
 * render its own <html>/<body> and cannot use the app shell or providers.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body style={{ background: "#09090b", color: "#e4e4e7" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.07)",
              borderRadius: "1rem",
              padding: "2rem",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", color: "#fecaca", margin: 0 }}>
              StrideIQ failed to load
            </h2>
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.875rem",
                color: "#a1a1aa",
              }}
            >
              An unexpected error stopped the app from starting. Try again, or reload the page.
            </p>
            <button
              onClick={() => unstable_retry()}
              style={{
                marginTop: "1.5rem",
                background: "#10b981",
                color: "#09090b",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.5rem 1rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
