"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatedMetric } from "./animated-metric";

export function ReadinessRing({
  score,
  size = 120,
  className,
  showGlow = false,
}: {
  score: number;
  size?: number;
  className?: string;
  showGlow?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const [progress, setProgress] = useState(0);
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  const color =
    clamped >= 70
      ? "#2dd4bf"
      : clamped >= 50
        ? "#fbbf24"
        : "#f87171";

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setProgress(clamped));
    });
    return () => cancelAnimationFrame(t);
  }, [clamped]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Readiness ${clamped} out of 100`}
    >
      {showGlow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-2xl"
          style={{
            background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
          }}
          aria-hidden
        />
      ) : null}
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chart-ring-track)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="absolute z-10 flex flex-col items-center">
        <AnimatedMetric
          value={clamped}
          className="font-display text-3xl font-bold text-white"
        />
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          ready
        </span>
      </div>
    </div>
  );
}
