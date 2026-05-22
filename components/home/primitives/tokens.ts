/** Balanced density: premium hierarchy, workspace-width layout */
export const dash = {
  pad: "p-3.5 sm:p-4",
  padHero: "p-4 sm:p-5 lg:p-6",
  padCompact: "p-3 sm:p-4",
  padRail: "px-4 py-3.5 sm:px-5",
  sectionGap: "gap-3 sm:gap-4",
  gridGap: "gap-3 sm:gap-4 lg:gap-5",
  surface:
    "relative overflow-visible rounded-xl bg-[#0c0d10]/95 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_10px_40px_-18px_rgba(0,0,0,0.55)]",
  surfaceSubdued:
    "relative overflow-visible rounded-xl bg-[#0a0b0e]/80 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
  surfaceElevated:
    "relative overflow-visible rounded-xl bg-[#0e1015]/98 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_12px_44px_-16px_rgba(0,0,0,0.5)]",
  surfaceHover:
    "transition-[box-shadow,background] duration-250 ease-out hover:bg-[#101218]/90",
  label:
    "text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  labelAccent:
    "text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-500/90",
  h1: "font-display text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl lg:text-[1.75rem]",
  lead: "text-[13px] leading-relaxed text-zinc-400 lg:text-sm",
  metric: "font-display text-xl font-bold tabular-nums tracking-tight text-white sm:text-2xl",
  metricSm: "font-display text-lg font-semibold tabular-nums text-white",
  muted: "text-xs leading-snug text-zinc-500",
} as const;

export const ops = {
  dashboard: "flex w-full flex-col gap-3 sm:gap-4 lg:gap-5",
  weekRow:
    "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-5",
  /** 12-col workspace grid: insights dominate */
  intelRow:
    "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5 lg:items-start",
  intelMain: "lg:col-span-7 xl:col-span-8",
  intelSide: "lg:col-span-5 xl:col-span-4",
  panelShell: "flex flex-col",
  panelHeader: "mb-2.5 flex items-center justify-between gap-2",
} as const;
