import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".open-next/**",
    "next-env.d.ts",
    ".claude/**",
    "docs/**",
    "test-results/**",
    "playwright-report/**",
    // Local research scratch, git-ignored (see .gitignore).
    "fetch-admitad.cjs",
    "fetch-links.cjs",
  ]),
]);

export default eslintConfig;
