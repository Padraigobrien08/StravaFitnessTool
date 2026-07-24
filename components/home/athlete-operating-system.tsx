"use client";

import type { HomeOperatingSystemView } from "@/lib/home/operatingSystemView";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import type { CalendarWorkout } from "@/lib/training-calendar";
import { OsHero } from "./os/os-hero";
import { OsWeekCalendar } from "./os/os-week-calendar";
import { OsToday } from "./os/os-today";
import { OsChangeFeed } from "./os/os-change-feed";
import { OsDecisionSupport } from "./os/os-decision-support";
import { OsTrajectory } from "./os/os-trajectory";
import { OsMemory } from "./os/os-memory";
import { OsInvestigations } from "./os/os-investigations";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export function AthleteOperatingSystem({
  vm,
  savedWeek,
  calendarHydrated,
  onPatchWorkout,
  onGeneratePlan,
  planLoading,
}: {
  vm: HomeOperatingSystemView;
  savedWeek: TrainingCalendarWeek | null;
  calendarHydrated: boolean;
  onPatchWorkout?: (
    id: string,
    patch: Partial<Pick<CalendarWorkout, "title" | "distanceKm" | "durationMin" | "status">>,
  ) => void;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
}) {
  return (
    <div className="athlete-os flex w-full flex-col gap-3 sm:gap-3.5">
      <OsHero hero={vm.hero} onGeneratePlan={onGeneratePlan} planLoading={planLoading} />

      <OsWeekCalendar
        savedWeek={savedWeek}
        hydrated={calendarHydrated}
        onPatchWorkout={onPatchWorkout}
        onGeneratePlan={onGeneratePlan}
        planLoading={planLoading}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <OsToday today={vm.today} />
        <OsChangeFeed items={vm.changeFeed} />
      </div>

      <OsDecisionSupport
        risks={vm.risks}
        opportunities={vm.opportunities}
        primaryActionBullets={vm.primaryActionBullets}
      />

      {/* Supporting context — collapsed by default so Home opens on the
          actionable core. Each panel also has a full destination of its own
          (Performance, Intelligence, Coach). */}
      <CollapsibleSection
        variant="card"
        title="More context"
        summary="trajectory · what StrideIQ learned · questions for Coach"
        className="mt-1"
      >
        <OsTrajectory items={vm.trajectory} />
        <OsMemory memory={vm.memory} />
        <OsInvestigations />
      </CollapsibleSection>
    </div>
  );
}
