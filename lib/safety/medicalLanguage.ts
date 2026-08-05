/**
 * Shared medical-language vocabulary.
 *
 * StrideIQ recommends training, never clinical care. Two jobs, deliberately
 * asymmetric:
 *
 *  - `softenMedicalLanguage()` rewrites the narrow set of terms that have a
 *    clean, grammatical training-language equivalent ("diagnose" → "assess").
 *  - `containsMedicalClaim()` detects anything reading as diagnosis, treatment,
 *    or medical certainty. Detection is intentionally **broader** than
 *    rewriting: a claim about a named clinical condition ("this will cure your
 *    stress fracture") cannot be regex-rewritten into safety, so it is flagged
 *    instead. Callers escalate — for weekly plans, a flagged claim that survives
 *    repair causes `buildSafeFallbackWeeklyPlan` to replace the plan wholesale,
 *    which is the only reliably safe outcome.
 *
 * Both layers previously kept their own short lists (and the integrity layer kept
 * two divergent copies), so clinical verbs and every named condition passed
 * unflagged. This module is the single source of truth.
 */

/** Rewrites with an unambiguous, grammatical substitution. Order matters: inflected forms first. */
const SOFTENINGS: readonly [RegExp, string][] = [
  [/\bdiagnosing\b/gi, "assessing"],
  [/\bdiagnoses\b/gi, "assesses"],
  [/\bdiagnosed\b/gi, "assessed"],
  [/\bdiagnosis\b/gi, "assessment"],
  [/\bdiagnose\b/gi, "assess"],
  [/\bprescribing\b/gi, "suggesting"],
  [/\bprescribes\b/gi, "suggests"],
  [/\bprescribed\b/gi, "suggested"],
  [/\bprescriptions\b/gi, "suggestions"],
  [/\bprescription\b/gi, "suggestion"],
  [/\bprescribe\b/gi, "suggest"],
  [/\bguaranteed\b/gi, "likely"],
  [/\btreating\b/gi, "supporting"],
  [/\btreatments\b/gi, "sessions"],
  [/\btreatment\b/gi, "session"],
  [/\btreats\b/gi, "supports"],
  [/\btreat\b/gi, "support"],
  [/\bcuring\b/gi, "helping"],
  [/\bcures\b/gi, "helps"],
  [/\bcure\b/gi, "help"],
  [/\bhealing\b/gi, "recovery"],
  [/\bheals\b/gi, "recovers"],
  [/\bheal\b/gi, "recover"],
  [/\brehabilitating\b/gi, "recovering"],
  [/\brehabilitate\b/gi, "recover"],
  [/\brehabbing\b/gi, "recovering"],
  [/\brehab\b/gi, "recovery work"],
];

/**
 * Named clinical conditions. Mentioning one in a recommendation is a diagnosis
 * claim regardless of surrounding wording, so these are flag-only.
 *
 * Deliberately excludes benign body-part and load words a training plan needs —
 * "achilles", "IT band", "strain", "sore" — to avoid false positives on
 * legitimate mobility or load guidance. Clinical qualifiers are required.
 */
const CONDITION_PATTERNS: readonly RegExp[] = [
  /\btendin(itis|opathy)\b/i,
  /\btendonitis\b/i,
  /\bstress (fracture|reaction)\b/i,
  /\bplantar fasciitis\b/i,
  /\bshin splints\b/i,
  /\bit band syndrome\b/i,
  /\brunner'?s knee\b/i,
  /\bpatellofemoral\b/i,
  /\bbursitis\b/i,
  /\bsciatica\b/i,
  /\bcompartment syndrome\b/i,
  /\bovertraining syndrome\b/i,
  /\bred-s\b/i,
  /\banaemia\b|\banemia\b/i,
];

/** Clinical action or medical certainty asserted about the athlete. */
const CLAIM_PATTERNS: readonly RegExp[] = [
  // Clinical verbs — caught here as well as softened, because callers such as
  // evaluateRecommendation() score raw text that never passed through softening.
  /\btreat(s|ed|ing|ment|ments)?\b/i,
  /\bcur(e|es|ed|ing)\b/i,
  /\bheal(s|ed|ing)?\b/i,
  /\brehab(bing|ilitate|ilitation)?\b/i,
  /\btherapy\b/i,
  /\bphysio(therapy)?\b/i,
  /\bmedication\b/i,
  // Diagnosis / prescription (pre-softening, or if softening was skipped).
  /\bdiagnos(e|es|ed|is|ing)\b/i,
  /\bprescri(be|bes|bed|bing|ption|ptions)\b/i,
  // Medical certainty.
  /\bmedical advice\b/i,
  /\bmedically (ready|cleared|fit)\b/i,
  /\bcleared for\b.*\b(race|racing|training)\b/i,
  /\binjury[- ]free guarantee\b/i,
  /\bguarantee(s|d)?\b.*\b(injury|injuries|recovery)\b/i,
  /\bprevent(s|ing)?\b.*\binjur/i,
  /\bno risk of\b.*\binjur/i,
];

/**
 * Safe disclaimers, neutralised before detection so they cannot self-trigger.
 * `repairPlanFromIntegrity` adds "Not medical advice: consult a professional…"
 * on repair — without this, a correctly-repaired plan would be flagged again and
 * needlessly discarded in favour of the fallback.
 */
const DISCLAIMER_PATTERNS: readonly RegExp[] = [
  /\bnot medical advice\b/gi,
  /\bnot a substitute\b/gi,
  /\bconsult (a|your) (professional|doctor|physician|physio(therapist)?|clinician|medical professional)\b/gi,
  /\bseek (medical|professional) (advice|help|guidance)\b/gi,
  /\bmedical professional\b/gi,
  /\bif you suspect\b/gi,
];

/**
 * Benign coaching idioms that merely borrow a clinical word. "Treat this as a
 * recovery week" is ordinary coach-speak, not a medical claim, so it is shielded
 * from both rewriting and detection.
 */
const BENIGN_IDIOM_PATTERNS: readonly RegExp[] = [
  // "treat <the long run|this|it|…> as …" — bounded so it cannot swallow a real
  // claim, and a named condition inside it would still match CONDITION_PATTERNS.
  /\btreat (?:this|that|it|these|those|them|the [\w\s]{1,20}?) as\b/gi,
];

const IDIOM_SENTINEL = "@@IDIOM@@";

/** Run `fn` with benign idioms masked out, then restore them verbatim. */
function preservingIdioms(text: string, fn: (masked: string) => string): string {
  const found: string[] = [];
  const masked = BENIGN_IDIOM_PATTERNS.reduce(
    (s, p) =>
      s.replace(p, (m) => {
        found.push(m);
        return IDIOM_SENTINEL;
      }),
    text,
  );
  const processed = fn(masked);
  let i = 0;
  return processed.replace(new RegExp(IDIOM_SENTINEL, "g"), () => found[i++] ?? "");
}

/** Strip safe disclaimer phrasing so it is not mistaken for a medical claim. */
export function stripDisclaimers(text: string): string {
  return DISCLAIMER_PATTERNS.reduce((s, p) => s.replace(p, " "), text);
}

/** Match the replacement's capitalisation to the word it replaces. */
function matchCase(matched: string, replacement: string): string {
  if (!/^[A-Z]/.test(matched)) return replacement;
  return replacement.charAt(0).toUpperCase() + replacement.slice(1);
}

/**
 * Rewrite medical wording that has a safe training-language equivalent.
 * Capitalisation is preserved so a sentence-initial term does not become
 * lower-case mid-prose ("Healing the calves" → "Recovery the calves").
 */
export function softenMedicalLanguage(text: string): string {
  return preservingIdioms(text, (masked) =>
    SOFTENINGS.reduce(
      (s, [pattern, replacement]) => s.replace(pattern, (m) => matchCase(m, replacement)),
      masked,
    ),
  );
}

/** Remove safe disclaimers and benign idioms so neither is read as a claim. */
function scrubForDetection(text: string): string {
  return BENIGN_IDIOM_PATTERNS.reduce((s, p) => s.replace(p, " "), stripDisclaimers(text));
}

/**
 * True when the text reads as diagnosis, treatment, or medical certainty.
 * Disclaimers and benign idioms are excluded first.
 */
export function containsMedicalClaim(text: string): boolean {
  const scrubbed = scrubForDetection(text);
  return (
    CONDITION_PATTERNS.some((p) => p.test(scrubbed)) || CLAIM_PATTERNS.some((p) => p.test(scrubbed))
  );
}

/** Which patterns matched — for test diagnostics and issue messages. */
export function medicalClaimMatches(text: string): string[] {
  const scrubbed = scrubForDetection(text);
  return [...CONDITION_PATTERNS, ...CLAIM_PATTERNS]
    .filter((p) => p.test(scrubbed))
    .map((p) => p.source);
}
