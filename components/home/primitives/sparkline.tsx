"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

const VB_W = 120;
const VB_H = 32;

export function Sparkline({
  data,
  className,
  height = 32,
  stroke = "rgba(45, 212, 191, 0.9)",
  fill = "url(#spark-fill)",
  animate = true,
  positive,
  fullWidth = false,
}: {
  data: number[];
  className?: string;
  height?: number;
  stroke?: string;
  fill?: string;
  animate?: boolean;
  positive?: boolean;
  fullWidth?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const h = height;
  const w = fullWidth ? VB_W : 72;
  const values = data.filter((v) => Number.isFinite(v) && v > 0);

  useEffect(() => {
    if (!animate) return;
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [animate, data.join(",")]);

  const strokeColor =
    positive === false
      ? "rgba(251, 191, 36, 0.85)"
      : positive === true
        ? "rgba(45, 212, 191, 0.9)"
        : stroke;

  if (values.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={cn(fullWidth ? "h-8 w-full" : "opacity-30", className)}
        style={fullWidth ? undefined : { width: w, height: h }}
        aria-hidden
      >
        <line
          x1={4}
          y1={VB_H / 2}
          x2={VB_W - 4}
          y2={VB_H / 2}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (VB_W - 8) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = 4 + i * step;
    const y = VB_H - 4 - ((v - min) / range) * (VB_H - 8);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${VB_H - 4} L 4 ${VB_H - 4} Z`;
  const pathLen = points.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
  }, 0);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={cn("sparkline-enter", fullWidth ? "h-8 w-full" : "shrink-0", className)}
      style={fullWidth ? undefined : { width: w, height: h }}
      role="img"
      aria-label="Trend"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45, 212, 191, 0.22)" />
          <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={fill === "url(#spark-fill)" ? `url(#spark-fill-${uid})` : fill}
        style={{ opacity: mounted ? 1 : 0 }}
      />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
        style={{
          strokeDasharray: pathLen,
          strokeDashoffset: mounted ? 0 : pathLen,
          transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </svg>
  );
}

export function TrendChart({
  data,
  className,
  height = 44,
  positive = true,
}: {
  data: number[];
  className?: string;
  height?: number;
  positive?: boolean;
}) {
  return (
    <Sparkline
      data={data}
      height={height}
      className={className}
      positive={positive}
      fullWidth
      stroke={positive ? "rgba(45, 212, 191, 0.95)" : "rgba(251, 191, 36, 0.9)"}
    />
  );
}
