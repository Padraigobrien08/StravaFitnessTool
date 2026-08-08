import type { Instrumentation } from "next";

/**
 * Server boot and error reporting.
 *
 * `register` runs once before the server accepts requests; `onRequestError` fires for
 * every server-side error Next catches. Before this file existed, a production failure
 * reached the athlete as a 500 and was recorded nowhere.
 *
 * Both hooks import lazily. `instrumentation.ts` is evaluated in the Edge runtime too,
 * where Node built-ins are unavailable, and a throw here would take the server down —
 * which is a much worse failure than the one it is trying to report.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const [{ checkEnvCoherence, formatEnvIssues }, { logger }] = await Promise.all([
      import("@/lib/env"),
      import("@/lib/observability/logger"),
    ]);

    const issues = checkEnvCoherence();

    // `checkEnvCoherence` is pure, so it can only see that the API-key user id is set,
    // not that it resolves. That distinction is the whole failure: a later OAuth makes
    // a new user row and the hand-set id quietly names an empty account, which the web
    // UI never reveals because a browser session carries its own id.
    try {
      const { checkApiKeyUser } = await import("@/lib/env/apiKeyUser");
      const apiKeyIssue = await checkApiKeyUser();
      if (apiKeyIssue) issues.push(apiKeyIssue);
    } catch {
      // A database that is not up yet must not hold up the server.
    }

    if (issues.length === 0) return;

    // Printed as prose as well as structured, because the audience for this one is a
    // human reading a deploy log, not a query.
    console.warn(formatEnvIssues(issues));
    logger.warn({
      event: "env.incoherent",
      errors: issues.filter((i) => i.level === "error").map((i) => i.key),
      warnings: issues.filter((i) => i.level === "warn").map((i) => i.key),
    });
  } catch {
    // Never let instrumentation prevent the server from starting.
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { logger, serializeError } = await import("@/lib/observability/logger");
    logger.error({
      event: "request.error",
      error: serializeError(err),
      // Path only — the query string carries user-supplied values, and headers carry
      // the session cookie. Neither belongs in a log sink.
      path: request.path.split("?")[0],
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
    });
  } catch {
    // Reporting must not raise a second error inside the error handler.
  }
};
