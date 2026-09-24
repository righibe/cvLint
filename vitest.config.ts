import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/i18n/**/*.ts", "src/components/checker/format-finding.ts"],
      exclude: ["src/lib/site.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
