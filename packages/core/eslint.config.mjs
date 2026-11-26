import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // These match the app's transitional type-hygiene posture: visible in
      // editor/CI output without blocking the extraction on legacy patterns.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  }
);
