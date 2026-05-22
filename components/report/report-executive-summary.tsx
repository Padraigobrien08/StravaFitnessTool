import type { ExecutiveSummaryView } from "@/lib/report/viewModels";

export function ReportExecutiveSummary({ data }: { data: ExecutiveSummaryView }) {
  return (
    <div className="report-executive rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm print:border-zinc-300 print:shadow-none sm:p-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-800/90 print:text-teal-900">
        {data.headline}
      </p>
      <p className="mt-4 font-display text-lg font-semibold leading-snug text-zinc-900 print:text-black sm:text-xl">
        {data.blockSummary}
      </p>
      <dl className="mt-6 space-y-3 border-t border-zinc-200/80 pt-5 print:border-zinc-300">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Key signal
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-zinc-800 print:text-zinc-900">
            {data.keySignal.replace(/^Key signal:\s*/i, "")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Biggest opportunity
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-zinc-800 print:text-zinc-900">
            {data.biggestOpportunity.replace(/^Biggest opportunity:\s*/i, "")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Projected readiness
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-zinc-800 print:text-zinc-900">
            {data.projectedReadiness.replace(/^Projected readiness:\s*/i, "")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
