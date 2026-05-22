import type { CoachPromptGroup } from "./types";

export const COACH_PROMPT_GROUPS: CoachPromptGroup[] = [
  {
    id: "understand",
    title: "Understand my training",
    description: "Reasoning over your history — not generic advice.",
    prompts: [
      "Why did my readiness change this week?",
      "What likely caused my recent improvement?",
      "Compare my last 3 threshold sessions",
    ],
  },
  {
    id: "plan",
    title: "Plan ahead",
    description: "Grounded in readiness, fatigue, and your goal.",
    prompts: [
      "What should next week focus on?",
      "Am I ready for my race?",
      "What pacing strategy fits my current fitness?",
    ],
  },
  {
    id: "patterns",
    title: "Analyze patterns",
    description: "Longitudinal blocks, fade, and adaptation.",
    prompts: [
      "What type of training helps me improve pace most?",
      "When was my strongest aerobic training block?",
      "Why do I fade late in long runs?",
    ],
  },
  {
    id: "ecosystem",
    title: "Cross-training & recovery",
    description: "Strength, mobility, interference, and full training context.",
    prompts: [
      "Is my gym work helping or hurting my running?",
      "Should I do strength this week?",
      "How much cross-training did I do this month?",
      "Am I stacking too much intensity?",
      "Am I training like a runner, hybrid athlete, or triathlete?",
      "Does cycling support my race goal?",
      "What should I reduce before race week?",
    ],
  },
];
