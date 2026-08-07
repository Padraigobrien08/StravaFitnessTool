import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_STRAVA_SCOPES, STRAVA_OPTIONAL_FEATURES, STRAVA_SCOPE_GROUPS } from "../mcpScopes";
import { STRAVA_SCOPES } from "../api/config";

/**
 * `mcpScopes.ts` is a data table, so testing its contents against itself would assert
 * nothing that can fail. What *can* fail is its agreement with the rest of the repo:
 * it names OAuth scopes declared elsewhere and MCP tools defined elsewhere, and
 * nothing links the copies.
 *
 * That is the same shape as the MCP parity defect the audit found (§G-2), where a
 * hand-maintained tool table drifted 29 tools behind the registry while the docs
 * claimed parity. These are the assertions that would have caught it.
 */

/** Every `strava_*` and composite tool name the MCP package actually defines. */
function toolsDefinedInPackage(): Set<string> {
  const sources = [
    "packages/strideiq-mcp/src/strava-tools.ts",
    "packages/strideiq-mcp/src/composite-tools.ts",
    "packages/strideiq-mcp/src/intelligence-tools.ts",
  ].map((f) => readFileSync(f, "utf8"));
  const names = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(/"([a-z][a-z0-9_]*)"/g)) names.add(m[1]);
  }
  return names;
}

const listedTools = [
  ...STRAVA_SCOPE_GROUPS.flatMap((g) => g.tools),
  ...STRAVA_OPTIONAL_FEATURES.flatMap((f) => f.tools),
];

describe("scope strings agree across the repo", () => {
  /**
   * `STRAVA_SCOPES` is what the OAuth request actually asks Strava for.
   * `DEFAULT_STRAVA_SCOPES` is what this table tells an MCP user to expect. If they
   * drift, the app requests one set of permissions while documenting another, and the
   * mismatch only shows up as a tool failing at runtime for a permission the athlete
   * was never asked to grant.
   */
  it("the documented default matches the scopes actually requested", () => {
    expect(DEFAULT_STRAVA_SCOPES).toBe(STRAVA_SCOPES);
  });

  // A third copy is hardcoded as the fallback when upserting a connection, so a
  // reconnect would silently record different scopes than were granted.
  it("the connection fallback uses the same scopes", () => {
    const src = readFileSync("lib/db/strava-connection.ts", "utf8");
    expect(src).toContain(STRAVA_SCOPES);
  });

  it("every group's scope appears in the requested set", () => {
    const requested = new Set(STRAVA_SCOPES.split(","));
    for (const group of STRAVA_SCOPE_GROUPS) {
      expect(requested.has(group.scope), `${group.scope} is documented but never requested`).toBe(
        true,
      );
    }
  });
});

describe("every tool named here exists", () => {
  const defined = toolsDefinedInPackage();

  it.each(listedTools)("%s is defined in the MCP package", (tool) => {
    expect(defined.has(tool), `${tool} is listed under a scope but defined nowhere`).toBe(true);
  });

  // A tool listed twice would tell the athlete they need two different scopes for it.
  it("lists no tool under more than one scope group", () => {
    const seen = new Set<string>();
    const duplicates = STRAVA_SCOPE_GROUPS.flatMap((g) => g.tools).filter((t) => {
      if (seen.has(t)) return true;
      seen.add(t);
      return false;
    });
    expect(duplicates).toEqual([]);
  });

  it("describes every scope group, since the description is what the user reads", () => {
    for (const g of STRAVA_SCOPE_GROUPS) {
      expect(g.description.length).toBeGreaterThan(3);
      expect(g.tools.length).toBeGreaterThan(0);
    }
  });

  it("names every optional feature and attaches tools to it", () => {
    for (const f of STRAVA_OPTIONAL_FEATURES) {
      expect(f.feature.length).toBeGreaterThan(3);
      expect(f.tools.length).toBeGreaterThan(0);
    }
  });
});
