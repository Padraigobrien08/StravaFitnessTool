/** Balanced density: premium hierarchy, workspace-width layout */
export const dash = {
  pad: "p-3.5 sm:p-4",
  padHero: "p-4 sm:p-5 lg:p-6",
  padCompact: "p-3 sm:p-4",
  padRail: "px-4 py-3.5 sm:px-5",
  sectionGap: "gap-3 sm:gap-4",
  gridGap: "gap-3 sm:gap-4 lg:gap-5",
  surface:
    "relative overflow-visible rounded-xl bg-[var(--surface-elevated)] shadow-[var(--surface-shadow)]",
  surfaceSubdued:
    "relative overflow-visible rounded-xl bg-[var(--surface-subdued)] shadow-[var(--surface-shadow-subtle)]",
  surfaceElevated:
    "relative overflow-visible rounded-xl bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]",
  surfaceHover:
    "transition-[box-shadow,background] duration-250 ease-out hover:bg-[var(--surface-hover)]",
  label: "type-section-label",
  labelAccent: "type-eyebrow",
  h1: "type-page-title",
  lead: "type-body-muted max-w-2xl",
  metric: "type-metric",
  metricSm: "font-display text-lg font-semibold tabular-nums tracking-[-0.02em] text-foreground",
  muted: "type-caption",
} as const;

export const ops = {
  dashboard: "flex w-full flex-col gap-3 sm:gap-4 lg:gap-5",
  weekRow: "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-5",
  /** 12-col workspace grid: insights dominate */
  intelRow: "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5 lg:items-start",
  intelMain: "lg:col-span-7 xl:col-span-8",
  intelSide: "lg:col-span-5 xl:col-span-4",
  panelShell: "flex flex-col",
  panelHeader: "mb-2.5 flex items-center justify-between gap-2",
} as const;
