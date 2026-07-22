import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

/**
 * Minimal tagged-template surface shared by both drivers. Every call site uses
 * `const rows = await sql`…`` then indexes/iterates the result, so this is all
 * the app relies on. Neon's HTTP driver and node-postgres both satisfy it.
 */
export type SqlClient = <
  // Rows are dynamically shaped; call sites cast with `as SomeRow`, matching
  // how the Neon driver previously typed results.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T = any,
>(
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<T[]>;

// Reuse one client across hot-reloads in dev; a fresh `postgres()` pool per
// reload would leak connections until the local server is exhausted.
const globalForDb = globalThis as unknown as { __strideiqSql?: SqlClient };

/**
 * Neon's serverless driver only speaks Neon's HTTP protocol, so we pick it only
 * for Neon connection strings and fall back to standard node-postgres (local
 * Docker, or any self-hosted Postgres) otherwise. Override with DB_DRIVER.
 */
function isNeonUrl(url: string): boolean {
  const override = process.env.DB_DRIVER?.toLowerCase();
  if (override === "neon") return true;
  if (override === "postgres") return false;
  try {
    return new URL(url).hostname.includes("neon.tech");
  } catch {
    return false;
  }
}

function createClient(url: string): SqlClient {
  if (isNeonUrl(url)) {
    return neon(url) as unknown as SqlClient;
  }
  const requireSsl = /sslmode=require|ssl=true/.test(url);
  return postgres(url, {
    ssl: requireSsl ? "require" : false,
    max: 10,
    // Neon's driver returns json/jsonb columns already parsed into objects;
    // the postgres driver hands them back as strings. Parse them here (by
    // column type OID: 114 = json, 3802 = jsonb) so call sites can read
    // `row.payload.foo` regardless of which driver is active.
    transform: {
      value: {
        from: (value: unknown, column: { type: number }) => {
          if (typeof value === "string" && (column.type === 114 || column.type === 3802)) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        },
      },
    },
  }) as unknown as SqlClient;
}

export function getSql(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForDb.__strideiqSql) {
    globalForDb.__strideiqSql = createClient(url);
  }
  return globalForDb.__strideiqSql;
}
