import type { Insight } from "@/lib/insights/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const severityStyles = {
  positive: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
  },
  neutral: {
    border: "border-white/10",
    bg: "bg-white/[0.03]",
    icon: Info,
    iconClass: "text-zinc-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    icon: AlertTriangle,
    iconClass: "text-amber-400",
  },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const style = severityStyles[insight.severity];
  const Icon = style.icon;

  return (
    <article
      className={cn(
        "rounded-xl border p-5",
        style.border,
        style.bg
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconClass)} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-zinc-100">{insight.title}</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
            {insight.evidence.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
          {insight.recommendation && (
            <p className="mt-3 text-sm text-emerald-300/90">
              → {insight.recommendation}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-600">
            Confidence: {insight.confidence}
          </p>
        </div>
      </div>
    </article>
  );
}
