export type AdaptiveCoachTopic =
  "adaptation" | "readiness" | "taper" | "outcomes" | "history" | "fatigue" | "all";

const PATTERNS: { pattern: RegExp; topic: AdaptiveCoachTopic }[] = [
  { pattern: /\bwhat historically improves my pace\b/i, topic: "adaptation" },
  { pattern: /\bwhy did readiness improve\b/i, topic: "readiness" },
  { pattern: /\bis this taper working\b/i, topic: "taper" },
  { pattern: /\bam i adapting well to threshold\b/i, topic: "adaptation" },
  { pattern: /\bcompare this block to my strongest\b/i, topic: "history" },
  { pattern: /\bdid the last recommendation help\b/i, topic: "outcomes" },
  { pattern: /\bwhat tends to fatigue me most\b/i, topic: "fatigue" },
  { pattern: /\bwhat have you learned\b/i, topic: "all" },
];

export function classifyAdaptiveCoachQuestion(text: string): AdaptiveCoachTopic | null {
  const t = text.trim();
  for (const { pattern, topic } of PATTERNS) {
    if (pattern.test(t)) return topic;
  }
  return null;
}
