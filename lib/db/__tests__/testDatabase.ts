/**
 * Opt-in, local-only gate for the destructive database round-trip tests.
 *
 * These suites `DELETE` rows. They used to be gated on `DATABASE_URL` alone,
 * which is the same variable `.env.local` points at a production Neon instance —
 * so exporting it, or teaching `vitest.config.ts` to load `.env.local`, would
 * have turned `npm test` into a destructive operation against real user data.
 * They only skipped by luck, not by design.
 *
 * Two changes close that off:
 *
 *  1. **A separate variable.** Nothing runs unless `TEST_DATABASE_URL` is set
 *     explicitly, so no ambient production credential can switch these on.
 *  2. **A host allowlist.** A non-local `TEST_DATABASE_URL` **throws** rather
 *     than skipping. Silently skipping would hide the very misconfiguration
 *     worth shouting about.
 *
 * Run them with:
 *   docker compose up -d
 *   TEST_DATABASE_URL=postgresql://strideiq:strideiq@localhost:5432/strideiq npx vitest run lib/db
 */

/** Hostnames accepted as a developer's own throwaway database. */
const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  // Docker networking: the compose service name, and the host gateway.
  "db",
  "postgres",
  "strideiq-db",
  "host.docker.internal",
]);

export function databaseHostname(url: string): string | null {
  try {
    // Strip IPv6 brackets so "[::1]" compares equal to "::1".
    return new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

/** True when the connection string points at a local, throwaway Postgres. */
export function isLocalDatabaseUrl(url: string): boolean {
  const host = databaseHostname(url);
  return host !== null && LOCAL_HOSTNAMES.has(host);
}

function resolveTestDatabaseUrl(): string | undefined {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) return undefined;

  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      `TEST_DATABASE_URL must point at a local database — these tests DELETE rows.\n` +
        `Got host: ${databaseHostname(url) ?? "(unparseable URL)"}\n` +
        `Allowed: ${[...LOCAL_HOSTNAMES].join(", ")}\n` +
        `Start one with \`docker compose up -d\` and use ` +
        `postgresql://strideiq:strideiq@localhost:5432/strideiq`,
    );
  }

  // getSql() reads DATABASE_URL, so point it at the test database for this
  // process. This also overrides any production value inherited from the shell.
  process.env.DATABASE_URL = url;
  return url;
}

export const testDatabaseUrl = resolveTestDatabaseUrl();

/** Gate for `describe.skipIf(!hasTestDb)`. */
export const hasTestDb = !!testDatabaseUrl;
