"use client";

import Link from "next/link";
import type { KpiViewModel } from "@/lib/home/dashboardData";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "./primitives/dashboard-panel";
import { Sparkline } from "./primitives/sparkline";
import { DeltaBadge } from "./primitives/delta-badge";
import { AnimatedMetric } from "./primitives/animated-metric";
import { dash } from "./primitives/tokens";

function KpiTile({ kpi }: { kpi: KpiViewModel }) {
  const inner = (
    <DashboardPanel subdued hover className="h-full">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={dash.label}>{kpi.label}</p>
          <div className="mt-1">
            {kpi.numericValue != null ? (
              <AnimatedMetric value={kpi.numericValue} className={dash.metric} />
            ) : (
              <span className={dash.metric}>{kpi.value}</span>
            )}
          </div>
          {kpi.context ? (
            <p className={cn(dash.muted, "mt-1 line-clamp-1")}>{kpi.context}</p>
          ) : null}
          {kpi.delta ? (
            <div className="mt-1.5">
              <DeltaBadge text={kpi.delta.text} positive={kpi.delta.positive} />
            </div>
          ) : null}
        </div>
        <Sparkline
          data={kpi.sparkline}
          height={26}
          positive={kpi.sparkPositive}
        />
      </div>
    </DashboardPanel>
  );

  if (kpi.href) {
    return (
      <Link href={kpi.href} className="block h-full min-w-0">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function KpiStripDashboard({ kpis }: { kpis: KpiViewModel[] }) {
  return (
    <div
      className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
      role="group"
      aria-label="Key metrics"
    >
      {kpis.map((kpi) => (
        <KpiTile key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}
