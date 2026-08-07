import path from "path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, ".") };

// A git worktree checked out inside the repo (e.g. .claude/worktrees/*) carries a
// full copy of the suite; without this the run collects every test twice and
// reports doubled counts.
const exclude = ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/**"];

// Clock displacement is opt-in via PROBE_NOW and costs nothing when unset — see
// test/time-travel.ts. Listed first so it runs before any other setup.
const timeTravel = "./test/time-travel.ts";

/**
 * Two projects, because the two kinds of test have genuinely different needs.
 *
 * The node project is everything that existed before: server code, analytics, parsing.
 * It must keep running without a DOM — several of those modules guard on
 * `typeof window === "undefined"`, and giving them a jsdom global would quietly stop
 * testing the server path they exist to cover.
 *
 * The ui project adds jsdom and Testing Library for component tests only. Scoping it
 * this way also keeps the ~1250 existing tests at their current speed, since jsdom
 * setup costs roughly a second per file.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          setupFiles: [timeTravel],
          exclude: [...exclude, "components/**", "app/**/__tests__/**/*.ui.test.*"],
        },
      },
      {
        // No @vitejs/plugin-react: its current major reaches @babel/core 8.0.0-rc
        // through a peer chain, and a release-candidate compiler is not worth pulling
        // in to run tests. tsconfig sets `jsx: react-jsx`, which Vite's esbuild
        // transform honours on its own — the plugin's real job is Fast Refresh, which
        // a test run has no use for.
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          setupFiles: [timeTravel, "./test/ui-setup.ts"],
          include: ["components/**/*.test.{ts,tsx}", "app/**/*.ui.test.{ts,tsx}"],
          exclude,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      // Report on shipped code; skip tests, fixtures, types, and generated files.
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "stores/**/*.{ts,tsx}",
      ],
      exclude: ["**/__tests__/**", "**/*.test.*", "**/*.d.ts", "**/types.ts", "**/fixtures*.ts"],
    },
  },
  resolve: { alias },
});
