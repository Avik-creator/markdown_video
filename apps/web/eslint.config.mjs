import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const nextRootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    settings: {
      next: {
        // ESLint may be invoked by an editor with the monorepo root as cwd.
        rootDir: nextRootDir,
      },
    },
    rules: {
      // Keep the initial rollout useful on this existing codebase: legacy type
      // hygiene, intentional literal-comment JSX, and React Compiler migration
      // findings stay visible without blocking CI. The classic rules-of-hooks
      // check remains an error.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/jsx-no-comment-textnodes": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "public/**",
    "lib/render-sandbox/cli-bundle/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.tsbuildinfo",
  ]),
]);
