import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarIntensity } from "@/lib/training-calendar";

/* ============================================================================
 * Console kit — shared primitives for the "instrument" design language.
 *
 * These are the vocabulary every console-styled page composes from, so the
 * surfaces stay consistent instead of drifting into parallel panel systems.
 * Colour comes from the scoped --home-* / --hz-* tokens in globals.css.
 * ========================================================================== */

/* --------------------------------- tokens --------------------------------- */

/** Effort scale — mirrors CalendarIntensity, doubles as the accent system. */
export const ZONE_COLOR: Record<CalendarIntensity, string> = {
  easy: "var(--hz-easy)",
  recovery: "var(--hz-recovery)",
  moderate: "var(--hz-moderate)",
  hard: "var(--hz-hard)",
  rest: "var(--hz-rest)",
};

export const ZONE_LEGEND: { key: CalendarIntensity; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "recovery", label: "Recovery" },
  { key: "moderate", label: "Moderate" },
  { key: "hard", label: "Hard" },
  { key: "rest", label: "Rest" },
];

/** good → warning → critical, keyed off a status label. Separate from the accent. */
export function verdictTone(label: string): { color: string; wash: string } {
  const l = label.toLowerCase();
  if (l.includes("fresh") || l.includes("ready") || l.includes("good") || l.includes("strong"))
    return {
      color: "var(--home-good)",
      wash: "color-mix(in srgb, var(--home-good) 12%, transparent)",
    };
  if (l.includes("fatigued") || l.includes("risk") || l.includes("high") || l.includes("redline"))
    return {
      color: "var(--home-redline)",
      wash: "color-mix(in srgb, var(--home-redline) 12%, transparent)",
    };
  return { color: "var(--home-signal)", wash: "var(--home-signal-wash)" };
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* -------------------------------- surfaces -------------------------------- */

/** Elevated panel — the base card for every console surface. `bare` drops padding. */
export function Panel({
  children,
  className,
  bare,
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl bg-[var(--surface-elevated)] shadow-[var(--surface-shadow)] ring-1 ring-[var(--border-subtle)]",
        !bare && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Uppercase instrument-panel label. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Panel header: eyebrow on the left, optional link/action on the right. */
export function PanelHeader({
  title,
  href,
  action,
  className,
}: {
  title: ReactNode;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <Eyebrow>{title}</Eyebrow>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 font-mono text-[11px] text-zinc-500 hover:text-[var(--home-signal)]"
        >
          {action} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

/* --------------------------------- data ----------------------------------- */

/** Small label/value stat for status strips. */
export function StatItem({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] tabular-nums",
          hot ? "text-[var(--home-signal)]" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Key/value row with a hairline divider (use inside a `divide-y` container). */
export function LoadRow({ k, v, sub }: { k: ReactNode; v: ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-[13px] text-muted-foreground">{k}</span>
      <span className="font-mono text-[15px] tabular-nums text-foreground">
        {v}
        {sub ? <span className="ml-1.5 text-[11px] text-zinc-500">{sub}</span> : null}
      </span>
    </div>
  );
}

/** The oversized mono "race-clock" readout. Pass the size via `className`. */
export function Readout({
  value,
  unit,
  className,
}: {
  value: ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono font-bold leading-none tracking-tight tabular-nums text-foreground",
        className,
      )}
    >
      {value}
      {unit ? (
        <span className="ml-1 text-[0.4em] font-medium tracking-normal text-zinc-500">{unit}</span>
      ) : null}
    </p>
  );
}

/** Gradient effort/readiness meter with a needle and banded labels. */
export function Meter({
  pct,
  labels,
  active,
}: {
  /** 0 = left (good) … 100 = right (critical). */
  pct: number;
  labels: string[];
  active?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div
        className="relative h-2.5 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--home-good), var(--hz-moderate) 55%, var(--home-redline))",
          opacity: 0.9,
        }}
      >
        <span
          className="absolute -top-1 h-4.5 w-[3px] rounded-sm bg-foreground"
          style={{
            left: `calc(${clamped}% - 1.5px)`,
            boxShadow: "0 0 0 2px var(--surface-elevated)",
          }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px]">
        {labels.map((b) => (
          <span
            key={b}
            className={cn(
              active?.toLowerCase() === b.toLowerCase()
                ? "font-semibold text-foreground"
                : "text-zinc-500",
            )}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Filled confidence/progress bar with a trailing percentage. */
export function ProgressBar({
  pct,
  label = "Confidence",
  color = "var(--home-signal)",
  className,
}: {
  pct: number;
  label?: string;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-subdued)] ring-1 ring-[var(--border-subtle)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
        />
      </span>
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

/** Signal-accented area sparkline. Non-scaling stroke so it stays crisp when stretched. */
export function Sparkline({
  values,
  className,
  color = "var(--home-signal)",
  height = 48,
}: {
  values: number[];
  className?: string;
  color?: string;
  height?: number;
}) {
  const w = 300;
  const h = height;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gid = `spark-${Math.round(values[0] ?? 0)}-${values.length}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Effort-zone legend row. */
export function ZoneLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {ZONE_LEGEND.map((z) => (
        <span
          key={z.key}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-500"
        >
          <span className="h-1 w-4 rounded-full" style={{ background: ZONE_COLOR[z.key] }} />
          {z.label}
        </span>
      ))}
    </div>
  );
}

/** A titled, colour-dotted bullet column (risks / opportunities / actions). */
export function DecisionColumn({
  title,
  items,
  color,
  href,
  coachLabel = "Coach",
  emptyLabel = "None flagged",
}: {
  title: string;
  items: string[];
  color: string;
  href?: string;
  coachLabel?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-subdued)] p-3 ring-1 ring-[var(--border-subtle)]">
      <p
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-[11px] text-zinc-600">{emptyLabel}</li>
        ) : (
          items.slice(0, 4).map((t) => (
            <li key={t} className="flex gap-1.5 text-[12px] leading-snug text-zinc-300">
              <span className="text-zinc-600">–</span>
              <span>{t}</span>
            </li>
          ))
        )}
      </ul>
      {href ? (
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-300"
        >
          {coachLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}
