import type { Insight } from "@/lib/insights/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TypographyCaption, TypographyList } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const severityStyles = {
  positive: {
    className: "border-emerald-500/30 bg-emerald-500/5",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
  },
  neutral: {
    className: "border-white/10 bg-white/[0.03]",
    icon: Info,
    iconClass: "text-zinc-400",
  },
  warning: {
    className: "border-amber-500/30 bg-amber-500/5",
    icon: AlertTriangle,
    iconClass: "text-amber-400",
  },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const style = severityStyles[insight.severity];
  const Icon = style.icon;

  return (
    <Alert className={cn("rounded-xl p-5", style.className)}>
      <Icon className={cn("size-5", style.iconClass)} />
      <AlertTitle className="type-title text-base">{insight.title}</AlertTitle>
      <AlertDescription>
        <TypographyList className="my-2 text-[0.875rem]">
          {insight.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </TypographyList>
        {insight.recommendation ? (
          <p className="type-body-muted font-medium text-emerald-400/90">
            → {insight.recommendation}
          </p>
        ) : null}
        <TypographyCaption className="mt-2">Confidence: {insight.confidence}</TypographyCaption>
      </AlertDescription>
    </Alert>
  );
}
