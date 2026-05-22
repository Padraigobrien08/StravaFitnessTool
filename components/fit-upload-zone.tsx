"use client";

import { useCallback, useRef, useState } from "react";
import { FileArchive, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FitUploadZone({
  onFiles,
  loading,
  error,
  success,
  fitProgress,
  runsWithFit,
  totalRuns,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  loading?: boolean;
  error?: string | null;
  success?: string | null;
  fitProgress?: { done: number; total: number };
  runsWithFit: number;
  totalRuns: number;
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      onFiles(Array.from(fileList));
    },
    [onFiles]
  );

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl border transition-colors",
          compact ? "p-4" : "p-5",
          dragOver
            ? "border-teal-400/50 bg-teal-500/10"
            : "border-white/[0.08] bg-white/[0.02]"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-start gap-3">
          <FileArchive className={cn("shrink-0 text-teal-400/90", compact ? "h-6 w-6" : "h-8 w-8")} />
          <div className="min-w-0 flex-1">
            {!compact ? (
              <h3 className="font-medium text-zinc-100">FIT import</h3>
            ) : null}
            <p className={cn("text-zinc-500", compact ? "text-xs" : "mt-1 text-sm")}>
              Upload the <strong className="text-zinc-400">activities</strong> folder from
              your Strava archive (
              <code className="text-teal-400/90">.fit.gz</code> / <code className="text-teal-400/90">.fit</code>
              ).
            </p>
            {totalRuns > 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                FIT data loaded:{" "}
                <span className="font-medium text-emerald-400">
                  {runsWithFit} / {totalRuns}
                </span>{" "}
                runs
              </p>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error webkitdirectory
          webkitdirectory=""
          directory=""
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading
              ? fitProgress && fitProgress.total > 0
                ? `Parsing ${fitProgress.done}/${fitProgress.total}…`
                : "Parsing FIT…"
              : "Choose activities folder"}
          </Button>
          <p className="self-center text-xs text-zinc-600">
            Accepts .fit.gz and .fit files
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
}
