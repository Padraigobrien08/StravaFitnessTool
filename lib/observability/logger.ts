/**
 * Structured logging, with no dependency and no network egress.
 *
 * StrideIQ had no error reporting at all: a failure in production surfaced as a 500 to
 * the athlete and nothing anywhere else. This is the smallest thing that fixes that —
 * one JSON line per event on stdout/stderr, which every host (Vercel, Fly, a plain
 * container) already collects and makes searchable. Wiring a hosted provider later is
 * then a change to one function rather than a change to every call site.
 *
 * JSON rather than prose because the point is to be queryable: `level`, `event` and
 * `route` are the fields you filter on when something is wrong at 7am.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Keys whose values must never reach a log sink, matched case-insensitively. */
const SENSITIVE_KEY = /(secret|token|password|api[-_]?key|authorization|cookie|credential)/i;

/** Connection strings and bearer tokens carry credentials inside a single string. */
const CREDENTIAL_IN_URL = /\/\/([^:@/\s]+):([^@/\s]+)@/g;

const REDACTED = "[redacted]";

/**
 * Strip secrets from a value before it is logged.
 *
 * Redaction is by key name and by URL shape. It is deliberately blunt: over-redacting
 * a field costs a debugging round-trip, while under-redacting writes a live credential
 * into a log aggregator that may retain it for months.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof value === "string") return value.replace(CREDENTIAL_IN_URL, `//$1:${REDACTED}@`);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface LogFields {
  /** Short stable identifier for the kind of event, e.g. "request.error". */
  event: string;
  [key: string]: unknown;
}

/** Serialize an error without losing the stack, which is the part worth having. */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...("digest" in err ? { digest: String((err as { digest: unknown }).digest) } : {}),
      ...(err.cause ? { cause: serializeError(err.cause) } : {}),
    };
  }
  return { message: String(err) };
}

export function log(level: LogLevel, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...(redact(fields) as Record<string, unknown>),
  });
  // stderr for anything actionable so it separates cleanly in hosted log views.
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (fields: LogFields) => log("debug", fields),
  info: (fields: LogFields) => log("info", fields),
  warn: (fields: LogFields) => log("warn", fields),
  error: (fields: LogFields) => log("error", fields),
};
