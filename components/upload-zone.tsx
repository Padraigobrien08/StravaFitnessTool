"use client";

import { useCallback, useState } from "react";
import { Upload, FolderOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadZone({
  onFiles,
  loading,
  error,
  fitProgress,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  loading?: boolean;
  error?: string | null;
  fitProgress?: { done: number; total: number; parsing: boolean };
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      onFiles(Array.from(fileList));
    },
    [onFiles],
  );

  return (
    <div className="space-y-4">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
          compact ? "min-h-[140px] px-4 py-6" : "min-h-[220px] rounded-2xl",
          dragOver
            ? "border-accent/50 bg-accent/10"
            : "border-white/[0.08] bg-white/[0.02] hover:border-accent/35 hover:bg-white/[0.04]",
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
        <input
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error webkitdirectory is non-standard but supported
          webkitdirectory=""
          directory=""
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload className={cn("text-accent/80", compact ? "mb-2 h-8 w-8" : "mb-3 h-10 w-10")} />
        <p className={cn("font-medium text-zinc-100", compact ? "text-sm" : "text-lg")}>
          {compact ? "Drop Strava export folder" : "Drop your Strava export folder"}
        </p>
        <p className="mt-1 max-w-md text-center text-xs text-zinc-500 sm:text-sm">
          Needs <code className="text-accent/90">activities.csv</code>
          {compact ? "" : ", plus "}
          {!compact && (
            <>
              <code className="text-accent/90">activities/*.fit.gz</code> for streams.
            </>
          )}
        </p>
        <span className="mt-5 inline-flex">
          <Button type="button" disabled={loading}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {loading
              ? fitProgress?.parsing && fitProgress.total > 0
                ? `Parsing FIT ${fitProgress.done}/${fitProgress.total}…`
                : "Parsing…"
              : "Choose folder"}
          </Button>
        </span>
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
