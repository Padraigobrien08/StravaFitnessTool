import type { CoachingContext } from "@/lib/coaching-context";

/** Phrases and tokens grounded in coaching context — used to validate plan rationale. */
export function buildAllowedEvidenceTokens(context: CoachingContext): Set<string> {
  const tokens = new Set<string>();

  const add = (s: string | undefined | null) => {
    if (!s?.trim()) return;
    tokens.add(s.trim().toLowerCase());
    for (const part of s.split(/[\s,;·]+/)) {
      if (part.length >= 4) tokens.add(part.toLowerCase());
    }
  };

  add(context.currentState.stateSummary);
  add(context.currentState.primaryFocus);
  add(context.athlete.profileSummary);
  for (const p of context.athlete.knownPatterns) {
    add(p.summary);
    add(p.label);
  }
  for (const r of context.risks) {
    add(r.label);
    for (const e of r.evidence) add(e);
  }
  for (const o of context.opportunities) {
    add(o.label);
    for (const e of o.evidence) add(e);
  }
  for (const n of context.constraints.notes) add(n);
  for (const l of context.dataQuality.confidenceLimitations) add(l);
  add(context.recentTraining.summary);
  for (const w of context.recentTraining.weeks) {
    add(`${w.runDistanceKm} km`);
    add(`${w.hardRunCount} hard`);
    for (const c of w.changeNotes) add(c);
  }
  for (const s of context.recentTraining.notableSessions) add(s.note);
  if (context.forecast) {
    for (const c of context.forecast.positiveContributors) add(c);
    for (const c of context.forecast.negativeContributors) add(c);
    for (const u of context.forecast.uncertaintyDrivers) add(u);
    add(context.forecast.recommendation);
  }
  for (const m of [
    context.modalityContext.crossTrainingSummary,
    context.modalityContext.strengthSummary,
    context.modalityContext.mobilitySummary,
  ]) {
    add(m);
  }
  for (const i of context.modalityContext.interferenceRisks) add(i);

  if (context.currentState.readiness != null) {
    tokens.add(`readiness ${context.currentState.readiness}`);
    tokens.add(`${context.currentState.readiness}/100`);
  }
  if (context.currentState.freshness != null) {
    tokens.add(`freshness ${Math.round(context.currentState.freshness)}`);
  }
  tokens.add(context.currentState.fatigueState);
  tokens.add(context.currentState.intensityBalance);
  tokens.add(context.currentState.durability);
  tokens.add(context.currentState.specificity);

  return tokens;
}

export function evidenceItemGrounded(item: string, allowed: Set<string>): boolean {
  const lower = item.trim().toLowerCase();
  if (lower.length < 8) return false;

  const genericOnly =
    /^(recent training|training data|your data|current fitness|athlete context|load management)$/i;
  if (genericOnly.test(lower)) return false;

  if ([...allowed].some((t) => lower.includes(t) || t.includes(lower.slice(0, 12)))) {
    return true;
  }

  const groundedPatterns = [
    /\bfreshness\b/i,
    /\btsb\b/i,
    /\breadiness\b/i,
    /\bhard run/i,
    /\bvolume\b/i,
    /\btaper\b/i,
    /\brace week\b/i,
    /\befficiency\b/i,
    /\bconsistency\b/i,
    /\binterference\b/i,
    /\bstrength\b/i,
    /\bfatigue\b/i,
    /\bkm\b/i,
    /\b\d+\s*km\b/i,
    /\b\d+\s*\/\s*100\b/i,
    /\bpolarized\b/i,
    /\bpolarised\b/i,
    /\bintensity\b/i,
    /\bmodality\b/i,
    /\becosystem\b/i,
    /\barchetype\b/i,
    /\bmemory\b/i,
    /\bpattern\b/i,
    /\bctl\b/i,
    /\batl\b/i,
  ];
  return groundedPatterns.some((p) => p.test(lower));
}
