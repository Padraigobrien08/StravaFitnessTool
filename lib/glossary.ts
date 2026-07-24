/**
 * Plain-language definitions for the sports-science / statistics terms that
 * surface in the UI. Rendered at point of use via <JargonTerm>. Keep each
 * definition to one runner-friendly sentence — no jargon inside the jargon.
 */
export interface GlossaryEntry {
  /** Canonical short label shown when no children are passed. */
  label: string;
  /** One-sentence, runner-friendly explanation. */
  definition: string;
}

export const GLOSSARY = {
  sigma: {
    label: "σ",
    definition:
      "How far a run sits from your own typical, measured in standard deviations. ±2σ means unusually far from normal for you.",
  },
  ci: {
    label: "CI",
    definition:
      "Confidence interval — the range your true value most likely falls in, given how much data there is. Wider means less certain.",
  },
  ctl: {
    label: "CTL",
    definition:
      "Chronic Training Load — a rolling estimate of the fitness you've built from training volume and intensity over recent weeks.",
  },
  tsb: {
    label: "TSB",
    definition:
      "Training Stress Balance, i.e. freshness — recent fatigue subtracted from built-up fitness. Positive means fresh, negative means tired.",
  },
  cs: {
    label: "Critical speed",
    definition:
      "The fastest pace your aerobic system can hold with fatigue roughly steady — your aerobic ceiling.",
  },
  dprime: {
    label: "D′",
    definition:
      "Anaerobic distance reserve — how far you can run above critical speed before you run out, like a battery above your aerobic pace.",
  },
  rsquared: {
    label: "R²",
    definition:
      "Goodness of fit — how well the model matches your data, from 0 (poor) to 1 (perfect).",
  },
  mom: {
    label: "MoM",
    definition: "Month over month — the change compared with the previous month.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
