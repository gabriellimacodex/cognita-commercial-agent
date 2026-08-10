import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cognita/database": fileURLToPath(
        new URL("./packages/database/src/index.ts", import.meta.url),
      ),
      "@cognita/observability": fileURLToPath(
        new URL("./packages/observability/src/index.ts", import.meta.url),
      ),
      "@cognita/schemas": fileURLToPath(
        new URL("./packages/schemas/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["apps/**/*.unit.test.ts", "packages/**/*.unit.test.ts"],
    passWithNoTests: false,
  },
});
