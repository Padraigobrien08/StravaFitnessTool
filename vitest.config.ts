import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
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
      exclude: [
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.d.ts",
        "**/types.ts",
        "**/fixtures*.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
