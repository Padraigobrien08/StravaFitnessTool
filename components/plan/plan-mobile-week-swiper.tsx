"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarWorkout } from "@/lib/training-calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export function PlanMobileWeekSwiper({
  workouts,
  todayDateIso,
  initialIndex,
  onActiveIndexChange,
  onSwipePastStart,
  onSwipePastEnd,
  className = "lg:hidden",
  children,
}: {
  workouts: CalendarWorkout[];
  todayDateIso?: string;
  initialIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onSwipePastStart?: () => void;
  onSwipePastEnd?: () => void;
  className?: string;
  children: (props: {
    workout: CalendarWorkout;
    index: number;
    isToday: boolean;
    isActive: boolean;
  }) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex ?? 0);
  const touchStartX = useRef<number | null>(null);

  const todayIndex = workouts.findIndex(
    (w) =>
      (todayDateIso && w.date.slice(0, 10) === todayDateIso) ||
      w.date.slice(0, 10) === format(new Date(), "yyyy-MM-dd")
  );

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (!child) return;
    el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior });
  }, []);

  useEffect(() => {
    const start = initialIndex ?? (todayIndex >= 0 ? todayIndex : 0);
    setActiveIndex(start);
    requestAnimationFrame(() => scrollToIndex(start, "auto"));
  }, [initialIndex, todayIndex, scrollToIndex, workouts.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.children.length === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    if (closest !== activeIndex) {
      setActiveIndex(closest);
      onActiveIndexChange?.(closest);
    }
  }, [activeIndex, onActiveIndexChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - startX;
    const threshold = 48;
    if (activeIndex === 0 && delta > threshold) onSwipePastStart?.();
    if (activeIndex === workouts.length - 1 && delta < -threshold) {
      onSwipePastEnd?.();
    }
  };

  return (
    <div className={cn("plan-mobile-week-swiper", className)}>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-none"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {workouts.map((w, index) => {
          const isToday =
            todayIndex === index ||
            w.date.slice(0, 10) === format(new Date(), "yyyy-MM-dd");
          return (
            <div
              key={w.id}
              className={cn(
                "w-[min(100%,calc(100vw-2.5rem))] shrink-0 snap-center",
                isToday && "snap-always"
              )}
            >
              {children({
                workout: w,
                index,
                isToday,
                isActive: activeIndex === index,
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {workouts.map((w, i) => (
          <button
            key={w.id}
            type="button"
            aria-label={`Go to ${w.day}`}
            onClick={() => scrollToIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === activeIndex
                ? "w-5 bg-teal-500/70"
                : "w-1.5 bg-zinc-700 hover:bg-zinc-600",
              i === todayIndex && i !== activeIndex && "ring-1 ring-teal-500/40"
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-600">
        {workouts[activeIndex]
          ? `${workouts[activeIndex].day} · ${format(parseISO(workouts[activeIndex].date), "MMM d")}`
          : null}
        {activeIndex === 0 || activeIndex === workouts.length - 1 ? (
          <span className="text-zinc-700"> · swipe edge for adjacent week</span>
        ) : null}
      </p>
    </div>
  );
}
