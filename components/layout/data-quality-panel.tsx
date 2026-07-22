import type { ImportQualityReport } from "@/lib/quality/assessImport";
import { formatQualitySummary } from "@/lib/quality/assessImport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/confidence-badge";

export function DataQualityPanel({ report }: { report: ImportQualityReport }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Data quality</CardTitle>
        <ConfidenceBadge level={report.overallConfidence} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-400">{formatQualitySummary(report)}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {report.fieldCoverage.map((f) => (
            <li
              key={f.label}
              className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="text-zinc-500">{f.label}</span>
              <span className="tabular-nums text-zinc-300">
                {f.count}/{f.total} <span className="text-zinc-600">({f.level})</span>
              </span>
            </li>
          ))}
        </ul>
        {report.warnings.length > 0 && (
          <ul className="space-y-1 text-sm text-amber-400/90">
            {report.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
