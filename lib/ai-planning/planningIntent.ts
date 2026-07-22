import type { GenerateNextWeekPlanToolInput } from "./types";

const GENERATE_PATTERNS = [
  /\bbuild (my |the )?next week\b/i,
  /\bplan (my |the )?(next week|race week|taper)\b/i,
  /\bmake me a plan\b/i,
  /\bwhat should i (train|run|do) next week\b/i,
  /\bweekly (training )?plan\b/i,
  /\bnext week (of )?training\b/i,
  /\bgenerate next week\b/i,
  /\brace week plan\b/i,
  /\btaper plan\b/i,
  /\bgiven my (goal|race|hm|half|marathon)\b/i,
  /\bonly have (\d+|one|two|three|four|five|six|seven) days\b/i,
  /\b(train|available) (only |just )?(on )?(mon|tue|wed|thu|fri|sat|sun)/i,
  /\b(conservative|aggressive) (but safe )?plan\b/i,
  /\badjust next week\b/i,
];

const MODIFY_PATTERNS: { pattern: RegExp; mod: PlanModificationKind }[] = [
  { pattern: /\bmore conservative\b/i, mod: "more_conservative" },
  { pattern: /\b(make it |)conservative\b/i, mod: "more_conservative" },
  { pattern: /\b(aggressive but safe|more aggressive)\b/i, mod: "more_aggressive" },
  { pattern: /\bremove strength\b/i, mod: "remove_strength" },
  { pattern: /\badd mobility\b/i, mod: "add_mobility" },
  { pattern: /\breduce volume\b/i, mod: "reduce_volume" },
  { pattern: /\blower (the )?volume\b/i, mod: "reduce_volume" },
  { pattern: /\bonly (train |available )?(on )?/i, mod: "limit_days" },
  { pattern: /\b(mon|tue|wed|thu|fri|sat|sun)[\s,/]+(mon|tue|wed)/i, mod: "limit_days" },
];

const EXPLAIN_PATTERNS = [
  /\bexplain (why |)(this is |)(a )?taper\b/i,
  /\bwhy (is this |)a taper\b/i,
  /\bwhy (this|the) plan\b/i,
  /\bwhat if i (want to |)chase a pb\b/i,
  /\bwhat if i (go for|want) (a )?pb\b/i,
];

export type PlanModificationKind =
  | "more_conservative"
  | "more_aggressive"
  | "remove_strength"
  | "add_mobility"
  | "reduce_volume"
  | "limit_days";

const DAY_ABBREV: Record<string, string> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

export type PlanningRoute =
  | { kind: "generate"; args: GenerateNextWeekPlanToolInput }
  | { kind: "modify"; modification: PlanModificationKind; args: GenerateNextWeekPlanToolInput }
  | { kind: "explain"; topic: "taper" | "plan" | "pb" }
  | null;

function parseAvailableDays(text: string): string[] | undefined {
  const days: string[] = [];
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(DAY_ABBREV)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(lower) && !days.includes(label)) days.push(label);
  }
  const onlyHave = lower.match(/only have (\d+) days?/);
  if (onlyHave && days.length === 0) {
    return undefined;
  }
  return days.length >= 2 ? days : days.length === 1 ? days : undefined;
}

function parseDayCount(text: string): number | undefined {
  const m = text.match(/only have (\d+) days?/i);
  if (m) return parseInt(m[1], 10);
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  const w = text.match(/only have (one|two|three|four|five|six|seven) days?/i);
  if (w) return words[w[1].toLowerCase()];
  return undefined;
}

function parsePreference(
  text: string,
): GenerateNextWeekPlanToolInput["planPreference"] | undefined {
  if (/\bconservative\b/i.test(text)) return "conservative";
  if (/\baggressive\b/i.test(text)) return "aggressive";
  return undefined;
}

function parseRaceWeekHint(text: string): boolean {
  return /\brace week\b/i.test(text) || /\btaper plan\b/i.test(text);
}

export function parseToolInputFromMessage(text: string): GenerateNextWeekPlanToolInput {
  const args: GenerateNextWeekPlanToolInput = {};
  const pref = parsePreference(text);
  if (pref) args.planPreference = pref;
  const days = parseAvailableDays(text);
  if (days?.length) args.availableDays = days;
  const dayCount = parseDayCount(text);
  if (dayCount != null && dayCount <= 7) {
    args.constraints = [
      ...(args.constraints ?? []),
      `Athlete has only ${dayCount} training days available`,
    ];
  }
  if (parseRaceWeekHint(text)) {
    args.constraints = [...(args.constraints ?? []), "Focus on race-week or taper structure"];
  }
  if (/\bhm\b|half marathon|half-marathon/i.test(text)) {
    args.constraints = [...(args.constraints ?? []), "Half marathon goal context"];
  }
  if (/\bstrength training\b/i.test(text)) {
    args.constraints = [
      ...(args.constraints ?? []),
      "Account for existing strength training in the week",
    ];
  }
  return args;
}

export function classifyPlanningMessage(text: string, hasPreviousPlan: boolean): PlanningRoute {
  const t = text.trim();
  if (!t) return null;

  for (const p of EXPLAIN_PATTERNS) {
    if (p.test(t)) {
      if (/\bpb\b/i.test(t)) return { kind: "explain", topic: "pb" };
      if (/\btaper\b/i.test(t)) return { kind: "explain", topic: "taper" };
      return { kind: "explain", topic: "plan" };
    }
  }

  if (hasPreviousPlan) {
    for (const { pattern, mod } of MODIFY_PATTERNS) {
      if (pattern.test(t)) {
        return {
          kind: "modify",
          modification: mod,
          args: parseToolInputFromMessage(t),
        };
      }
    }
  }

  if (GENERATE_PATTERNS.some((p) => p.test(t))) {
    return { kind: "generate", args: parseToolInputFromMessage(t) };
  }

  if (hasPreviousPlan && /\b(strength|mobility|volume|days)\b/i.test(t)) {
    return {
      kind: "modify",
      modification: "more_conservative",
      args: parseToolInputFromMessage(t),
    };
  }

  return null;
}

/** @deprecated use classifyPlanningMessage */
export function isWeeklyPlanIntent(text: string): boolean {
  return classifyPlanningMessage(text, false)?.kind === "generate";
}

export function isPlanningIntent(text: string, hasPreviousPlan = false): boolean {
  return classifyPlanningMessage(text, hasPreviousPlan) != null;
}
