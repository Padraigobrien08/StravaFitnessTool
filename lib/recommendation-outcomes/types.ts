export type RecommendationProducer =
  "today_session" | "week_plan" | "goal_scenario" | "limiter_protocol" | "coach_brief";

/** Was the recommendation acted on? */
export type Adherence = "followed" | "partial" | "skipped" | "pending" | "unknown";

/**
 * A recommendation recorded at the moment it was made, so its outcome can be
 * evaluated later. The evaluation fields are filled lazily once the target date
 * has passed and actual runs are available.
 */
export interface LoggedRecommendation {
  /** Deterministic per producer + target date → re-generation is idempotent. */
  recommendationId: string;
  producer: RecommendationProducer;
  issuedAt: string;
  /** The day the advice was for (YYYY-MM-DD). */
  targetDate: string;
  /** e.g. "tempo" | "easy" | "long" | "rest" | "recovery" | "interval". */
  kind: string;
  headline: string;
  distanceKmMin: number | null;
  distanceKmMax: number | null;
  /** For strategic (goal-scenario) recs: the sustained weekly volume advised (km). */
  targetWeeklyKm?: number | null;

  // Adherence (lazily filled once the target day has passed).
  adherence?: Adherence;
  matchedRunIds?: string[];
  evaluationNote?: string;
  evaluatedAt?: string;

  // Outcome signal (filled for followed recommendations old enough for the
  // physiological effect to show in analytics). Did the advice actually work?
  outcomeSignal?: OutcomeSignal;
  outcomeNote?: string;
}

/** Whether current analytics support the recommendation's intended effect. */
export type OutcomeSignal = "supported" | "partially_supported" | "contradicted" | "inconclusive";
