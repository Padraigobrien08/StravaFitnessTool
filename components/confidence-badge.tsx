import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const labels = {
    low: "Limited data — trends are indicative",
    medium: "Moderate sample — trends are reasonably reliable",
    high: "Solid sample — trends are reliable",
  };
  const colors = {
    low: "border-amber-500/30 bg-amber-500/10 text-amber-400/90",
    medium: "border-sky-500/30 bg-sky-500/10 text-sky-400/90",
    high: "border-teal-500/30 bg-teal-500/10 text-teal-400/90",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-1", colors[level])}>
      {labels[level]}
    </Badge>
  );
}
