"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Route-level error boundary. Next wraps each route segment with this, so a
 * render error in one page shows a recoverable fallback instead of a blank
 * screen — and, unlike a top-level class boundary, it resets automatically
 * when the user navigates elsewhere.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <AlertTriangle className="h-6 w-6 text-red-300" />
        </div>
        <h2 className="text-lg font-medium text-red-100">
          Something went wrong on this page
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          This is usually a hiccup rendering your data. Try again, or head back
          to Import to re-load your activities.
        </p>
        {error.message && (
          <p className="mt-3 break-words rounded-lg bg-black/30 px-3 py-2 text-left font-mono text-xs text-zinc-500">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="mt-2 text-[11px] text-zinc-600">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => unstable_retry()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Link
            href="/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Upload className="mr-2 h-4 w-4" />
            Go to Import
          </Link>
        </div>
      </div>
    </div>
  );
}
