/**
 * Turn a weekly-plan failure into copy a runner can act on.
 *
 * The API answers with HTTP-shaped reasons ("Unauthorized", "Invalid body") and
 * the raw word used to reach the screen verbatim, which tells the athlete
 * nothing about what happened or what to do next. This maps the failure to a
 * plain-language title, a sentence of cause-and-consequence, and the label for
 * the recovery action, so the alert always names a next step.
 */

export interface PlanErrorPresentation {
  title: string;
  detail: string;
  /**
   * Label for the in-place recovery button, or null when it genuinely cannot
   * help. The server applies its auth guard before the deterministic fallback,
   * so on a 401 there is no local week to build: offering the button there
   * would promise something the app cannot deliver.
   */
  fallbackLabel: string | null;
  /** A navigation that does fix the problem, when one exists. */
  link: { label: string; href: string } | null;
  /** Whether retrying the same request could plausibly succeed. */
  canRetry: boolean;
  /** The underlying reason, kept for support/debugging rather than the headline. */
  raw: string;
}

export function planErrorPresentation(
  raw: string | null,
  status?: number | null,
): PlanErrorPresentation | null {
  if (!raw) return null;
  const reason = raw.trim();
  const lower = reason.toLowerCase();

  if (status === 401 || lower === "unauthorized") {
    return {
      title: "Planning needs your own training data",
      detail:
        "The planner builds a week from your account's training load, so it can't run on the sample athlete. Connect Strava or import an export, then generate.",
      fallbackLabel: null,
      link: { label: "Connect or import data", href: "/import" },
      canRetry: false,
      raw: reason,
    };
  }

  if (status === 400 || lower.includes("invalid body")) {
    return {
      title: "That planning context couldn't be read",
      detail: "Shorten the note and try again, or generate without any context.",
      fallbackLabel: null,
      link: null,
      canRetry: true,
      raw: reason,
    };
  }

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many")) {
    return {
      title: "The planner is rate limited",
      detail: "Wait a moment before generating again, or build a conservative week now.",
      fallbackLabel: "Build a safe week instead",
      link: null,
      canRetry: true,
      raw: reason,
    };
  }

  return {
    title: "The planner couldn't finish",
    detail: `Your saved week is unchanged. Try generating again, or build a conservative week from your recent load. (${reason})`,
    fallbackLabel: "Build a safe week instead",
    link: null,
    canRetry: true,
    raw: reason,
  };
}
