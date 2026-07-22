import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export function DeltaBadge({ text, positive }: { text: string; positive: boolean | null }) {
  const Icon = positive === true ? TrendingUp : positive === false ? TrendingDown : Minus;

  return (
    <Badge
      variant="ghost"
      className={cn(
        "h-auto gap-1 px-0 py-0 text-[11px] leading-tight font-normal",
        positive === true && "text-emerald-400/90 hover:text-emerald-400/90",
        positive === false && "text-amber-400/90 hover:text-amber-400/90",
        positive === null && "text-zinc-500 hover:text-zinc-500",
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      {text}
    </Badge>
  );
}
