export const PLAN_CONTEXT_MAX_CHARS = 2000;
export const PLAN_CONTEXT_COMPACT_ROWS = 4;
export const PLAN_CONTEXT_EXPANDED_ROWS = 12;

export const PLAN_CONTEXT_SUGGESTIONS = [
  "I just ran a half marathon — plan recovery for this week",
  "No race goal right now — rebuild aerobic base gently",
  "Traveling Thu–Sun — keep hard sessions Mon–Wed only",
  "Returning from illness — very conservative volume",
  "Want to add one strength session without compromising runs",
] as const;

export const PLAN_CONTEXT_STORAGE_KEY = "strideiq-plan-context-draft-v1";
