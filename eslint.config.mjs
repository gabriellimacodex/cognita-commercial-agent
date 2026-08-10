import eslint from "@eslint/js";
import nextConfig from "eslint-config-next";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/.cache/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "*.config.mjs",
      "vitest.*.config.ts",
      "apps/cockpit/next.config.ts",
      "tools/governance/**",
    ],
  },
  eslint.configs.recommended,
  ...nextConfig,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.mjs", "apps/cockpit/next.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      next: { rootDir: "apps/cockpit/" },
      react: { version: "19.2.8" },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  prettier,
);
