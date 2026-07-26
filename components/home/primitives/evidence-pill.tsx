import { cn } from "@/lib/utils";

export function EvidencePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "risk" | "caution" | "positive";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none tabular-nums",
        tone === "risk" && "bg-red-500/10 text-red-300/90",
        tone === "caution" && "bg-amber-500/10 text-amber-300/90",
        tone === "positive" && "bg-accent/10 text-accent/90",
        tone === "neutral" && "bg-white/[0.05] text-zinc-500",
      )}
    >
      {children}
    </span>
  );
}
