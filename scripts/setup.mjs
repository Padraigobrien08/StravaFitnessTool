// Scaffolds .env.local from .env.example and generates a SESSION_SECRET.
// Usage: npm run setup   (add --force to overwrite an existing .env.local)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const force = process.argv.includes("--force");

if (existsSync(".env.local") && !force) {
  console.log(
    ".env.local already exists — leaving it untouched.\n" +
      "Run `npm run setup -- --force` to regenerate it from .env.example.",
  );
  process.exit(0);
}

if (!existsSync(".env.example")) {
  console.error("Missing .env.example — are you in the project root?");
  process.exit(1);
}

const secret = randomBytes(32).toString("hex");
const contents = readFileSync(".env.example", "utf8").replace(
  /^SESSION_SECRET=.*$/m,
  `SESSION_SECRET=${secret}`,
);
writeFileSync(".env.local", contents);

console.log("✅ Created .env.local with a fresh SESSION_SECRET.\n");
console.log("Next steps:");
console.log("  1. docker compose up -d   → start local Postgres");
console.log("  2. npm run db:migrate     → create the schema");
console.log("  3. Add your Strava keys to .env.local");
console.log("       (create an app at https://www.strava.com/settings/api,");
console.log("        Authorization Callback Domain: localhost)");
console.log("  4. npm run dev            → open http://localhost:3000");
console.log("\n  Coach (AI chat) is optional — add OPENAI_API_KEY to enable it.");
