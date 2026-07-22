// Applies db/migrations/*.sql in order against DATABASE_URL.
// Tracks applied files in a _migrations table, so it is safe to re-run.
// Usage:
//   npm run db:migrate          apply any pending migrations
//   npm run db:reset            drop the public schema, then re-apply everything
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" + "Run `npm run setup` first, then `docker compose up -d`.",
  );
  process.exit(1);
}

const reset = process.argv.includes("--reset");
const requireSsl = /sslmode=require|ssl=true|neon\.tech/.test(url);
const sql = postgres(url, { ssl: requireSsl ? "require" : false, max: 1 });

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

try {
  if (reset) {
    console.log("⚠️  Resetting: dropping and recreating schema `public`…");
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;").simple();
  }

  await sql.unsafe(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  );
  const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`·  skip ${file} (already applied)`);
      continue;
    }
    process.stdout.write(`▶  ${file} … `);
    const content = readFileSync(join(migrationsDir, file), "utf8");
    await sql.unsafe(content).simple();
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log("done");
    ran++;
  }

  console.log(ran ? `\n✅ Applied ${ran} migration(s).` : "\n✅ Schema already up to date.");
} catch (err) {
  console.error(`\n❌ Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
