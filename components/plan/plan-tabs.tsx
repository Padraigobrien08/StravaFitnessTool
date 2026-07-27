"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanWorkspace } from "./plan-workspace";
import { RaceGoalWorkspace } from "@/components/goals/race-goal-workspace";

type PlanTab = "week" | "goal";

// Tab state lives in the URL (?tab=goal) so /goals redirects, Home tiles, and
// deep links all land on the right view. Panels render conditionally — base-ui
// Tabs.Panel keeps inactive panels mounted, which we don't want here.
export function PlanTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: PlanTab = searchParams.get("tab") === "goal" ? "goal" : "week";

  const setTab = (next: PlanTab) => {
    router.replace(next === "goal" ? "/plan?tab=goal" : "/plan", { scroll: false });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div
        className="flex w-fit rounded-lg border border-[var(--border-subtle)] p-0.5"
        role="tablist"
        aria-label="Plan view"
      >
        <TabButton active={tab === "week"} onClick={() => setTab("week")} icon={CalendarRange}>
          This week
        </TabButton>
        <TabButton active={tab === "goal"} onClick={() => setTab("goal")} icon={Target}>
          Race goal
        </TabButton>
      </div>

      {tab === "week" ? <PlanWorkspace /> : <RaceGoalWorkspace />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CalendarRange;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-accent/15 text-accent"
          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
