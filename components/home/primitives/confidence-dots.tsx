import type { InsightConfidence } from "@/lib/insights/types";
import { cn } from "@/lib/utils";

const levels: Record<InsightConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function ConfidenceDots({
  level,
  className,
}: {
  level: InsightConfidence;
  className?: string;
}) {
  const n = levels[level];
  return (
    <span
      className={cn("inline-flex gap-0.5", className)}
      title={`${level} confidence`}
      aria-label={`Confidence: ${level}`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("h-1 w-1 rounded-full", i <= n ? "bg-accent/80" : "bg-white/10")}
        />
      ))}
    </span>
  );
}
