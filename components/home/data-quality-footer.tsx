"use client";

import { useState } from "react";
import Link from "next/link";
import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { ConfidenceDots } from "./primitives/confidence-dots";
import type { InsightConfidence } from "@/lib/insights/types";

export function DataQualityFooter({ report }: { report: ImportQualityReport }) {
  const [open, setOpen] = useState(false);

  return (
    <footer className="shrink-0 border-t border-white/[0.04] pt-2">
      <button
        type="button"
        className="flex h-6 w-full items-center gap-2 text-left text-[10px] text-zinc-600 transition-colors hover:text-zinc-500"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex-1 truncate">
          Data quality · {report.overallConfidence}
          {report.warnings.length > 0
            ? ` · ${report.warnings.length} note${report.warnings.length === 1 ? "" : "s"}`
            : " · all clear"}
        </span>
        <ConfidenceDots level={report.overallConfidence as InsightConfidence} />
        <span className="text-zinc-700">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="mt-1 max-h-20 overflow-y-auto text-[10px] leading-relaxed text-zinc-600 scrollbar-none">
          {report.warnings.slice(0, 4).map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          <Link href="/settings" className="text-teal-600/80 hover:text-teal-400">
            Open diagnostics
          </Link>
        </div>
      ) : null}
    </footer>
  );
}
