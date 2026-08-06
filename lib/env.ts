/**
 * Environment coherence checks.
 *
 * StrideIQ is local-first: "try the demo" and Strava-export import run entirely in the
 * browser with **no environment variables at all**. So this deliberately does *not*
 * assert that variables are present — a boot validator demanding `DATABASE_URL` would
 * break a supported way to run the app.
 *
 * What it checks instead is that each feature group is *internally coherent*. Half a
 * configuration is the dangerous state: it looks configured, starts cleanly, and then
 * fails at the moment a user actually reaches for the feature. `STRIDEIQ_API_KEY`
 * without `STRIDEIQ_API_KEY_USER_ID` is the sharpest example — the key path goes
 * silently inert and every automation request just reads as unauthenticated.
 *
 * Values are never read into messages. Only variable names appear here.
 */

export type EnvIssueLevel = "error" | "warn";

export interface EnvIssue {
  level: EnvIssueLevel;
  /** The variable that should be set, or the one whose presence created the obligation. */
  key: string;
  /** What breaks, in terms of a user-visible feature. */
  message: string;
}

type Env = Record<string, string | undefined>;

/** Treat whitespace-only as unset — `.env.example` ships keys with empty values. */
function isSet(env: Env, key: string): boolean {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0;
}

const MIN_SESSION_SECRET_LENGTH = 16;

export function checkEnvCoherence(env: Env = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const set = (k: string) => isSet(env, k);

  // --- Database implies sessions -------------------------------------------------
  // `lib/auth/session.ts` throws when signing without a secret, so connected mode
  // would fail at the first OAuth callback rather than at boot.
  if (set("DATABASE_URL") && !set("SESSION_SECRET")) {
    issues.push({
      level: "error",
      key: "SESSION_SECRET",
      message:
        "DATABASE_URL is set but SESSION_SECRET is not — Strava sign-in will throw on the OAuth callback. Generate one with `openssl rand -hex 32`.",
    });
  }

  if (set("SESSION_SECRET") && (env.SESSION_SECRET as string).length < MIN_SESSION_SECRET_LENGTH) {
    issues.push({
      level: "error",
      key: "SESSION_SECRET",
      message: `SESSION_SECRET is shorter than ${MIN_SESSION_SECRET_LENGTH} characters — lib/auth/session.ts rejects it, so no session can be issued.`,
    });
  }

  // --- Strava OAuth is a pair ----------------------------------------------------
  const hasStravaId = set("STRAVA_CLIENT_ID");
  const hasStravaSecret = set("STRAVA_CLIENT_SECRET");
  if (hasStravaId !== hasStravaSecret) {
    const missing = hasStravaId ? "STRAVA_CLIENT_SECRET" : "STRAVA_CLIENT_ID";
    issues.push({
      level: "error",
      key: missing,
      message: `Strava OAuth is half-configured — ${missing} is missing, so the connect flow cannot complete.`,
    });
  }

  if ((hasStravaId || hasStravaSecret) && !set("DATABASE_URL")) {
    issues.push({
      level: "error",
      key: "DATABASE_URL",
      message:
        "Strava OAuth is configured but DATABASE_URL is not — there is nowhere to persist the athlete or their tokens.",
    });
  }

  // --- Webhooks: unsigned deliveries are rejected outright -----------------------
  // The delete branch removes activities, so verify.ts refuses unsigned input. A
  // subscription without the signing secret is a subscription that 403s every event.
  const wantsWebhooks = set("STRAVA_WEBHOOK_CALLBACK_URL") || set("STRAVA_WEBHOOK_VERIFY_TOKEN");
  if (wantsWebhooks && !set("STRAVA_WEBHOOK_SIGNING_SECRET")) {
    issues.push({
      level: "error",
      key: "STRAVA_WEBHOOK_SIGNING_SECRET",
      message:
        "Strava webhooks are configured but STRAVA_WEBHOOK_SIGNING_SECRET is not — every event delivery will be rejected with 403.",
    });
  }

  if (set("STRAVA_WEBHOOK_SIGNING_SECRET") && !set("STRAVA_WEBHOOK_VERIFY_TOKEN")) {
    issues.push({
      level: "warn",
      key: "STRAVA_WEBHOOK_VERIFY_TOKEN",
      message:
        "STRAVA_WEBHOOK_SIGNING_SECRET is set without STRAVA_WEBHOOK_VERIFY_TOKEN — Strava's subscription handshake cannot be answered.",
    });
  }

  // --- API key is a pair, and fails silently when it isn't -----------------------
  const hasKey = set("STRIDEIQ_API_KEY");
  const hasKeyUser = set("STRIDEIQ_API_KEY_USER_ID");
  if (hasKey !== hasKeyUser) {
    const missing = hasKey ? "STRIDEIQ_API_KEY_USER_ID" : "STRIDEIQ_API_KEY";
    issues.push({
      level: "error",
      key: missing,
      message: `API-key auth is half-configured — ${missing} is missing, so the key path is inert and every automation request reads as unauthenticated.`,
    });
  }

  // --- Coach needs a provider ----------------------------------------------------
  if (set("DATABASE_URL") && !set("OPENAI_API_KEY") && !set("ANTHROPIC_API_KEY")) {
    issues.push({
      level: "warn",
      key: "OPENAI_API_KEY",
      message:
        "No LLM provider key is set — Coach chat and AI weekly plans will fall back or fail. Dashboards and forecasting are unaffected.",
    });
  }

  return issues;
}

/** Human-readable summary for boot logs. Returns "" when there is nothing to say. */
export function formatEnvIssues(issues: EnvIssue[]): string {
  if (issues.length === 0) return "";
  const line = (i: EnvIssue) => `  ${i.level === "error" ? "✗" : "!"} ${i.key}: ${i.message}`;
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  return [
    "StrideIQ environment check:",
    ...errors.map(line),
    ...warns.map(line),
    errors.length > 0
      ? "  → Affected features will fail at use. See .env.example and docs/DEPLOYMENT.md."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
