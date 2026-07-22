"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanWeekBoard } from "@/components/plan/plan-week-board";
import type { TrainingCalendarWeek } from "@/lib/training-calendar";
import type { CalendarWorkout } from "@/lib/training-calendar";
import { OsSection } from "./os-section";

export function OsWeekCalendar({
  savedWeek,
  hydrated,
  onPatchWorkout,
  onGeneratePlan,
  planLoading,
}: {
  savedWeek: TrainingCalendarWeek | null;
  hydrated: boolean;
  onPatchWorkout?: (
    id: string,
    patch: Partial<Pick<CalendarWorkout, "title" | "distanceKm" | "durationMin" | "status">>,
  ) => void;
  onGeneratePlan?: () => void;
  planLoading?: boolean;
}) {
  const weekLabel = savedWeek?.weekStart
    ? `Week of ${format(parseISO(savedWeek.weekStart), "MMM d")}`
    : "Current week";

  return (
    <OsSection
      id="current-week"
      title="Current week"
      action={
        <Link href="/plan" className="text-[10px] text-zinc-600 hover:text-zinc-400">
          Full planner →
        </Link>
      }
    >
      {!hydrated ? (
        <div className="h-32 animate-pulse rounded-lg bg-[var(--surface)]" />
      ) : savedWeek ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/50 p-2 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[12px] text-zinc-400">{weekLabel}</p>
            <p className="text-[10px] text-zinc-600 line-clamp-1">{savedWeek.summary}</p>
          </div>
          <PlanWeekBoard
            week={savedWeek}
            variant="compact"
            editable={Boolean(onPatchWorkout)}
            onPatchWorkout={onPatchWorkout}
            mobileSwipe
          />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--surface)]/40 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-zinc-300">No saved week plan yet</p>
            <p className="mt-1 max-w-md text-[12px] text-zinc-600">
              Generate and save a plan to anchor your week here — you won&apos;t need to live on the
              Plan page.
            </p>
          </div>
          {onGeneratePlan ? (
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1"
              disabled={planLoading}
              onClick={onGeneratePlan}
            >
              <Sparkles className="h-3 w-3" />
              {planLoading ? "Generating…" : "Generate next week plan"}
            </Button>
          ) : (
            <Link href="/plan">
              <Button size="sm" className="h-8 gap-1">
                <Sparkles className="h-3 w-3" />
                Generate next week plan
              </Button>
            </Link>
          )}
        </div>
      )}
    </OsSection>
  );
}
