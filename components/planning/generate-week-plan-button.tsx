"use client";

import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import { Button } from "@/components/ui/button";
import { AiWeeklyPlanPanel } from "./ai-weekly-plan-panel";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function GenerateWeekPlanButton({
  label = "Generate next week",
  variant = "outline",
  className,
  onGenerated,
}: {
  label?: string;
  variant?: "outline" | "default" | "ghost";
  className?: string;
  onGenerated?: () => void;
}) {
  const { generate, loading, error, result } = useWeeklyPlan();

  return (
    <div className={cn("space-y-4", className)}>
      <Button
        type="button"
        variant={variant}
        disabled={loading}
        className="gap-2"
        onClick={async () => {
          const r = await generate();
          if (r) onGenerated?.();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error ? (
        <p className="text-sm text-red-400/90">{error}</p>
      ) : null}
      {result ? (
        <AiWeeklyPlanPanel
          plan={result.plan}
          guardrails={result.guardrails}
          source={result.source}
          validation={result.validation}
        />
      ) : null}
    </div>
  );
}
