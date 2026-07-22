import { cn } from "@/lib/utils";

/** Shared typography class strings (shadcn-style utility composition). */
export const type = {
  /** Marketing / page hero — Syne */
  display:
    "font-display text-[1.625rem] font-bold leading-[1.12] tracking-[-0.02em] text-foreground sm:text-[1.875rem]",
  /** Primary page heading */
  pageTitle:
    "font-display text-[1.375rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[1.625rem]",
  /** Secondary page heading */
  title: "font-display text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground",
  /** Card / panel section labels */
  sectionLabel: "text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-muted-foreground",
  /** Small caps accent (teal eyebrow) */
  eyebrow: "text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-primary/90",
  /** Default body */
  body: "text-[0.9375rem] leading-[1.55] text-foreground",
  /** Secondary body */
  bodyMuted: "text-[0.875rem] leading-[1.55] text-muted-foreground",
  /** Supporting copy */
  caption: "text-xs leading-relaxed text-muted-foreground",
  /** Form labels */
  label: "text-sm font-medium leading-none text-foreground",
  /** Large KPI / metric numbers */
  metric:
    "font-display text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums sm:text-[2rem]",
  /** Inline stat */
  stat: "text-sm font-medium tabular-nums text-foreground",
  /** Nav links */
  nav: "text-[0.8125rem] font-medium tracking-[-0.01em]",
} as const;

export function typeCn(base: keyof typeof type, className?: string): string {
  return cn(type[base], className);
}
