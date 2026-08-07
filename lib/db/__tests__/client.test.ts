import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Driver selection and connection options — the decision every other file in
 * `lib/db` depends on and none of them can compensate for.
 *
 * Neon's serverless driver speaks only Neon's HTTP protocol, so choosing it for a
 * self-hosted Postgres (or the reverse) does not degrade anything, it fails outright.
 * The SSL flag matters for a different reason: getting it wrong can mean connecting
 * in clear text to a server the operator asked to be verified.
 *
 * Both drivers are mocked, so nothing here opens a connection.
 */

type PgOptions = { ssl: unknown; max: number };

const neon = vi.fn((_url: string) => "NEON_CLIENT");
const postgres = vi.fn((_url: string, _options: PgOptions) => "PG_CLIENT");

vi.mock("@neondatabase/serverless", () => ({
  neon: (url: string) => neon(url),
}));
vi.mock("postgres", () => ({
  default: (url: string, options: PgOptions) => postgres(url, options),
}));

const ORIGINAL = { ...process.env };

/** `getSql` memoises on globalThis, so each case needs a clean slate. */
function resetClientCache() {
  delete (globalThis as { __strideiqSql?: unknown }).__strideiqSql;
}

beforeEach(() => {
  neon.mockClear();
  postgres.mockClear();
  resetClientCache();
  delete process.env.DB_DRIVER;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetClientCache();
});

async function sqlFor(url: string) {
  process.env.DATABASE_URL = url;
  const { getSql } = await import("../client");
  return getSql();
}

/** The options object handed to the node-postgres driver. */
const pgOptions = (): PgOptions => postgres.mock.calls[0][1];

describe("choosing a driver", () => {
  it("uses the Neon driver for a Neon host", async () => {
    await sqlFor("postgresql://u:p@ep-cool-name.us-east-2.aws.neon.tech/db?sslmode=require");
    expect(neon).toHaveBeenCalledOnce();
    expect(postgres).not.toHaveBeenCalled();
  });

  it("uses node-postgres for local Docker", async () => {
    await sqlFor("postgresql://strideiq:strideiq@localhost:5432/strideiq");
    expect(postgres).toHaveBeenCalledOnce();
    expect(neon).not.toHaveBeenCalled();
  });

  it("uses node-postgres for any other self-hosted server", async () => {
    await sqlFor("postgresql://u:p@db.internal.example.com:5432/app");
    expect(postgres).toHaveBeenCalledOnce();
  });

  it.each([
    ["neon", "postgresql://u:p@localhost:5432/db", "neon"],
    ["postgres", "postgresql://u:p@x.neon.tech/db", "postgres"],
    ["NEON", "postgresql://u:p@localhost:5432/db", "neon"],
  ])("DB_DRIVER=%s overrides the host", async (override, url, expected) => {
    process.env.DB_DRIVER = override;
    await sqlFor(url);
    if (expected === "neon") expect(neon).toHaveBeenCalledOnce();
    else expect(postgres).toHaveBeenCalledOnce();
  });

  // A malformed URL should not decide the driver by accident; node-postgres will
  // produce a comprehensible error, the Neon HTTP driver will not.
  it("falls back to node-postgres for an unparseable URL", async () => {
    await sqlFor("not-a-url");
    expect(postgres).toHaveBeenCalledOnce();
    expect(neon).not.toHaveBeenCalled();
  });

  /**
   * `hostname.includes("neon.tech")` is a substring test, so a self-hosted server
   * whose name merely contains that string is handed the wrong driver and cannot
   * connect at all. Contrived, but the check should match a domain suffix.
   */
  it("does not treat a host that merely contains neon.tech as Neon", async () => {
    await sqlFor("postgresql://u:p@neon.tech.db.mycompany.internal:5432/app");
    expect(postgres).toHaveBeenCalledOnce();
    expect(neon).not.toHaveBeenCalled();
  });
});

describe("SSL", () => {
  it("requires SSL when the URL asks for it", async () => {
    await sqlFor("postgresql://u:p@host:5432/db?sslmode=require");
    expect(pgOptions().ssl).toBe("require");
  });

  it("requires SSL for ssl=true", async () => {
    await sqlFor("postgresql://u:p@host:5432/db?ssl=true");
    expect(pgOptions().ssl).toBe("require");
  });

  it("does not require SSL for a plain local URL", async () => {
    await sqlFor("postgresql://strideiq:strideiq@localhost:5432/strideiq");
    expect(pgOptions().ssl).toBe(false);
  });

  /**
   * The one that matters. `verify-full` and `verify-ca` are *stronger* than
   * `require`, but the regex only looks for the literal `sslmode=require`, so an
   * operator who asked for a verified TLS connection silently gets `ssl: false`.
   */
  it.each(["verify-full", "verify-ca"])(
    "requires SSL for the stronger sslmode=%s",
    async (mode) => {
      await sqlFor(`postgresql://u:p@host:5432/db?sslmode=${mode}`);
      expect(pgOptions().ssl).not.toBe(false);
    },
  );

  it("does not require SSL when the URL explicitly disables it", async () => {
    await sqlFor("postgresql://u:p@host:5432/db?sslmode=disable");
    expect(pgOptions().ssl).toBe(false);
  });
});

describe("client reuse", () => {
  // A fresh pool per hot-reload leaks connections until the local server refuses new
  // ones, which is why this is memoised at all.
  it("creates the driver once and reuses it", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    const { getSql } = await import("../client");
    const a = getSql();
    const b = getSql();
    expect(a).toBe(b);
    expect(postgres).toHaveBeenCalledOnce();
  });

  it("refuses to guess when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const { getSql } = await import("../client");
    expect(() => getSql()).toThrow(/DATABASE_URL/);
  });
});
