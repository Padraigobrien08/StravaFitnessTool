import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export function DeltaBadge({
  text,
  positive,
}: {
  text: string;
  positive: boolean | null;
}) {
  const Icon =
    positive === true
      ? TrendingUp
      : positive === false
        ? TrendingDown
        : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] leading-tight",
        positive === true && "text-emerald-400/90",
        positive === false && "text-amber-400/90",
        positive === null && "text-zinc-500"
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      {text}
    </span>
  );
}
