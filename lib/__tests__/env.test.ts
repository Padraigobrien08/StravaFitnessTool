import { describe, expect, it } from "vitest";
import { checkEnvCoherence, formatEnvIssues } from "../env";

/**
 * The property that matters most here is the *negative* one: an empty environment
 * must produce zero issues. Demo mode and Strava-export import are supported ways to
 * run StrideIQ with nothing configured, so a check that nags about missing variables
 * would be wrong rather than merely noisy.
 */

const DB = "postgresql://localhost:5432/strideiq";
const SECRET = "0123456789abcdef0123";

describe("checkEnvCoherence", () => {
  it("says nothing about a completely empty environment", () => {
    expect(checkEnvCoherence({})).toEqual([]);
  });

  it("treats empty and whitespace-only values as unset", () => {
    // .env.example ships `STRAVA_CLIENT_ID=` with no value; that is not configuration.
    expect(checkEnvCoherence({ STRAVA_CLIENT_ID: "", STRAVA_CLIENT_SECRET: "  " })).toEqual([]);
  });

  it("passes a coherent full configuration", () => {
    expect(
      checkEnvCoherence({
        DATABASE_URL: DB,
        SESSION_SECRET: SECRET,
        STRAVA_CLIENT_ID: "123",
        STRAVA_CLIENT_SECRET: "abc",
        OPENAI_API_KEY: "sk-test",
      }),
    ).toEqual([]);
  });

  describe("database and sessions", () => {
    it("flags a database with no session secret", () => {
      const issues = checkEnvCoherence({ DATABASE_URL: DB });
      expect(issues.find((i) => i.key === "SESSION_SECRET")?.level).toBe("error");
    });

    it("flags a session secret that is too short to be accepted", () => {
      const issues = checkEnvCoherence({ DATABASE_URL: DB, SESSION_SECRET: "tooshort" });
      expect(issues.find((i) => i.key === "SESSION_SECRET")?.message).toMatch(/shorter than 16/);
    });
  });

  describe("paired credentials", () => {
    it.each([
      ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"],
      ["STRAVA_CLIENT_SECRET", "STRAVA_CLIENT_ID"],
      ["STRIDEIQ_API_KEY", "STRIDEIQ_API_KEY_USER_ID"],
      ["STRIDEIQ_API_KEY_USER_ID", "STRIDEIQ_API_KEY"],
    ])("flags %s set without %s", (present, missing) => {
      const issues = checkEnvCoherence({
        [present]: "value",
        DATABASE_URL: DB,
        SESSION_SECRET: SECRET,
      });
      expect(issues.find((i) => i.key === missing)?.level).toBe("error");
    });

    // The one that motivated this check: the key path fails open-looking rather than
    // loudly, so a working key with no user id reads as "not signed in" forever.
    it("explains that a half-configured API key is silently inert", () => {
      const issues = checkEnvCoherence({ STRIDEIQ_API_KEY: "k" });
      expect(issues.find((i) => i.key === "STRIDEIQ_API_KEY_USER_ID")?.message).toMatch(/inert/);
    });
  });

  describe("webhooks", () => {
    it("flags a subscription with no signing secret", () => {
      const issues = checkEnvCoherence({ STRAVA_WEBHOOK_CALLBACK_URL: "https://x/api" });
      const issue = issues.find((i) => i.key === "STRAVA_WEBHOOK_SIGNING_SECRET");
      expect(issue?.level).toBe("error");
      expect(issue?.message).toMatch(/403/);
    });

    it("warns when the handshake token is missing", () => {
      const issues = checkEnvCoherence({ STRAVA_WEBHOOK_SIGNING_SECRET: "s" });
      expect(issues.find((i) => i.key === "STRAVA_WEBHOOK_VERIFY_TOKEN")?.level).toBe("warn");
    });
  });

  describe("Strava without a database", () => {
    it("flags that there is nowhere to persist tokens", () => {
      const issues = checkEnvCoherence({ STRAVA_CLIENT_ID: "1", STRAVA_CLIENT_SECRET: "2" });
      expect(issues.find((i) => i.key === "DATABASE_URL")?.level).toBe("error");
    });
  });

  describe("LLM provider", () => {
    it("warns rather than errors, since dashboards still work", () => {
      const issues = checkEnvCoherence({ DATABASE_URL: DB, SESSION_SECRET: SECRET });
      const issue = issues.find((i) => i.key === "OPENAI_API_KEY");
      expect(issue?.level).toBe("warn");
      expect(issue?.message).toMatch(/Dashboards and forecasting are unaffected/);
    });

    it("is satisfied by OPENAI_API_KEY alone", () => {
      const issues = checkEnvCoherence({
        DATABASE_URL: DB,
        SESSION_SECRET: SECRET,
        OPENAI_API_KEY: "x",
      });
      expect(issues).toEqual([]);
    });

    /**
     * Coach takes either provider, but the weekly planner is OpenAI-only, so an
     * Anthropic-only deployment looks healthy while every plan is silently the
     * deterministic fallback. A warning rather than an error: Coach genuinely works.
     */
    it("warns that Anthropic alone means no LLM weekly plans", () => {
      const issues = checkEnvCoherence({
        DATABASE_URL: DB,
        SESSION_SECRET: SECRET,
        ANTHROPIC_API_KEY: "x",
      });
      const issue = issues.find((i) => /weekly plans are OpenAI-only/.test(i.message));
      expect(issue?.level).toBe("warn");
    });

    it("says nothing when both providers are configured", () => {
      const issues = checkEnvCoherence({
        DATABASE_URL: DB,
        SESSION_SECRET: SECRET,
        OPENAI_API_KEY: "x",
        ANTHROPIC_API_KEY: "y",
      });
      expect(issues).toEqual([]);
    });
  });

  // Boot logs are frequently shipped to third-party log sinks.
  it("never puts a secret's value in a message", () => {
    const issues = checkEnvCoherence({
      SESSION_SECRET: "short-secret-value",
      STRIDEIQ_API_KEY: "super-secret-key",
      DATABASE_URL: "postgresql://user:hunter2@host/db",
    });
    const text = JSON.stringify(issues) + formatEnvIssues(issues);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("super-secret-key");
    expect(text).not.toContain("short-secret-value");
  });
});

describe("formatEnvIssues", () => {
  it("is empty when there is nothing to report", () => {
    expect(formatEnvIssues([])).toBe("");
  });

  it("lists errors before warnings and only mentions failure when there are errors", () => {
    const out = formatEnvIssues([
      { level: "warn", key: "W", message: "warned" },
      { level: "error", key: "E", message: "errored" },
    ]);
    expect(out.indexOf("E:")).toBeLessThan(out.indexOf("W:"));
    expect(out).toMatch(/will fail at use/);
  });

  it("omits the failure line when everything is a warning", () => {
    expect(formatEnvIssues([{ level: "warn", key: "W", message: "warned" }])).not.toMatch(
      /will fail at use/,
    );
  });
});
