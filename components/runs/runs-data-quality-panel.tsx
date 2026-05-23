"use client";

import type { RunsDataQualityView } from "@/lib/runs/viewModels";

export function RunsDataQualityPanel({ data }: { data: RunsDataQualityView }) {
  const parts = [
    `HR coverage: ${data.hrCoveragePct >= 70 ? "high" : data.hrCoveragePct >= 40 ? "medium" : "low"}`,
    `FIT streams: ${data.fitCount} runs`,
    `Classification: ${data.classificationNote.split(";")[0]?.slice(0, 40) ?? "medium"}`,
  ];

  return (
    <footer className="border-t border-white/[0.04] pt-3 text-[10px] text-zinc-700">
      <span className="text-zinc-600">Data quality · </span>
      {parts.join(" · ")}
      {data.warnings[0] ? (
        <span className="text-zinc-600"> · {data.warnings[0]}</span>
      ) : null}
    </footer>
  );
}
