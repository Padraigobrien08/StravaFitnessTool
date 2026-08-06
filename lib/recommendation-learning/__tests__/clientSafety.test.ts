import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * The learning-loop barrel must stay importable from the browser.
 *
 * `lib/recommendation-learning/index.ts` is reachable from client code via
 * buildAdaptiveIntelligence -> adaptiveState -> use-athlete-intelligence. Exporting
 * `./persistence` from it pulled the Postgres driver into the client bundle and broke
 * `next build` with "Can't resolve 'fs'" — caught by the build, but only after the
 * fact, and only because the driver happens to need a Node built-in.
 */
describe("client-bundle safety", () => {
  it("the barrel does not re-export the database bridge", () => {
    const barrel = readFileSync("lib/recommendation-learning/index.ts", "utf8");
    const exportLines = barrel
      .split("\n")
      .filter((l) => l.trim().startsWith("export") || l.includes("from "));
    expect(exportLines.join("\n")).not.toMatch(/from\s+["']\.\/persistence["']/);
  });

  it("no module reachable from the barrel imports lib/db", () => {
    for (const f of [
      "lib/recommendation-learning/index.ts",
      "lib/recommendation-learning/trackRecommendationOutcome.ts",
      "lib/recommendation-learning/evaluateRecommendationOutcome.ts",
      "lib/recommendation-learning/updateBeliefsFromOutcome.ts",
      "lib/recommendation-learning/buildOutcomeEvidence.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must not import lib/db`).not.toMatch(/from\s+["']@\/lib\/db\//);
    }
  });

  it("the persistence module is the only one that touches lib/db", () => {
    const src = readFileSync("lib/recommendation-learning/persistence.ts", "utf8");
    expect(src).toMatch(/@\/lib\/db\/recommendation-outcome-log/);
  });
});
