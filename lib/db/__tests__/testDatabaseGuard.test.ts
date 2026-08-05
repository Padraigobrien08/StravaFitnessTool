import { describe, expect, it } from "vitest";
import { databaseHostname, isLocalDatabaseUrl } from "./testDatabase";

/**
 * The guard that keeps the destructive DB suites off a real database. Worth
 * testing directly: everything it protects is skipped by default, so a
 * regression here would be invisible until it deleted production rows.
 */

const LOCAL = [
  "postgresql://strideiq:strideiq@localhost:5432/strideiq",
  "postgresql://u:p@127.0.0.1:5432/db",
  "postgresql://u:p@[::1]:5432/db",
  "postgresql://u:p@0.0.0.0:5432/db",
  "postgresql://u:p@db:5432/db",
  "postgresql://u:p@postgres:5432/db",
  "postgresql://u:p@strideiq-db:5432/db",
  "postgresql://u:p@host.docker.internal:5432/db",
  "postgresql://u:p@LOCALHOST:5432/db", // case-insensitive
];

const REMOTE = [
  // The exact shape of the URL sitting in .env.local.
  "postgresql://u:p@ep-odd-frost-ajkj3uli-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require",
  "postgresql://u:p@db.example.com:5432/prod",
  "postgresql://u:p@10.0.0.5:5432/db",
  "postgresql://u:p@192.168.1.20:5432/db",
  "postgresql://u:p@localhost.evil.com:5432/db", // suffix trick
  "postgresql://u:p@notlocalhost:5432/db",
];

describe("isLocalDatabaseUrl", () => {
  it.each(LOCAL)("accepts a local host: %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each(REMOTE)("rejects a non-local host: %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });

  it("rejects an unparseable connection string", () => {
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(databaseHostname("not a url")).toBeNull();
  });
});

describe("databaseHostname", () => {
  it("normalises case and strips IPv6 brackets", () => {
    expect(databaseHostname("postgresql://u:p@LocalHost:5432/db")).toBe("localhost");
    expect(databaseHostname("postgresql://u:p@[::1]:5432/db")).toBe("::1");
  });
});
