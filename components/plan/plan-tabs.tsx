"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Target } from "lucide-react";
import { SegmentedControl, type SegmentedItem } from "@/components/ui/segmented-control";
import { PlanWorkspace } from "./plan-workspace";
import { RaceGoalWorkspace } from "@/components/goals/race-goal-workspace";

type PlanTab = "week" | "goal";

const TABS: SegmentedItem<PlanTab>[] = [
  { value: "week", label: "This week", icon: CalendarRange },
  { value: "goal", label: "Race goal", icon: Target },
];

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
      <SegmentedControl items={TABS} value={tab} onChange={setTab} ariaLabel="Plan view" />
      {tab === "week" ? <PlanWorkspace /> : <RaceGoalWorkspace />}
    </div>
  );
}
