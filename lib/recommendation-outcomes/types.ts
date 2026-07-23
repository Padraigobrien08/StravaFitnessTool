export type RecommendationProducer =
  "today_session" | "week_plan" | "goal_scenario" | "coach_brief";

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

  // Evaluation (lazily filled).
  adherence?: Adherence;
  matchedRunIds?: string[];
  evaluationNote?: string;
  evaluatedAt?: string;
}
