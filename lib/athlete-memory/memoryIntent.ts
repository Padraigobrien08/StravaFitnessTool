import type { BeliefCategory } from "./types";

const MEMORY_QUESTION_PATTERNS: {
  pattern: RegExp;
  topic: "all" | BeliefCategory;
}[] = [
  { pattern: /\bwhat have you learned about me\b/i, topic: "all" },
  { pattern: /\bwhat (do you |)know about me\b/i, topic: "all" },
  { pattern: /\bwhat training works best\b/i, topic: "adaptation" },
  { pattern: /\bwhat tends to make me fatigued\b/i, topic: "fatigue" },
  { pattern: /\bwhat makes me fatigued\b/i, topic: "fatigue" },
  { pattern: /\bwhat should we avoid next week\b/i, topic: "fatigue" },
  { pattern: /\bwhat patterns are (still )?uncertain\b/i, topic: "all" },
  { pattern: /\bwhat(?:'s| is) uncertain\b/i, topic: "all" },
  { pattern: /\bmy (taper|pacing|fatigue|adaptation) pattern/i, topic: "all" },
  { pattern: /\bwhat historically improves my pace\b/i, topic: "adaptation" },
  { pattern: /\bwhy did readiness improve\b/i, topic: "all" },
  { pattern: /\bis this taper working\b/i, topic: "taper" },
  { pattern: /\bam i adapting well to threshold\b/i, topic: "adaptation" },
  { pattern: /\bcompare this block to my strongest\b/i, topic: "all" },
  { pattern: /\bdid the last recommendation help\b/i, topic: "all" },
  { pattern: /\bwhat tends to fatigue me most\b/i, topic: "fatigue" },
];

export function classifyMemoryQuestion(
  text: string
): { kind: "memory"; topic: "all" | BeliefCategory } | null {
  const t = text.trim();
  for (const { pattern, topic } of MEMORY_QUESTION_PATTERNS) {
    if (pattern.test(t)) {
      let resolved: "all" | BeliefCategory = topic;
      if (topic === "all") {
        if (/fatig/i.test(t)) resolved = "fatigue";
        else if (/taper/i.test(t)) resolved = "taper";
        else if (/pacing|pace/i.test(t)) resolved = "pacing";
        else if (/strength|modality|cross/i.test(t)) resolved = "modality";
        else if (/adapt|works best|efficiency/i.test(t)) resolved = "adaptation";
      }
      return { kind: "memory", topic: resolved };
    }
  }
  return null;
}
