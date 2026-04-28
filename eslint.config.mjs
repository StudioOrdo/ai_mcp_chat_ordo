import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint configuration — static analysis governance layer
 *
 * eslint-config-next already bundles: @typescript-eslint, jsx-a11y, react, react-hooks.
 * This config extends those with stricter rules tuned for AI-generated code governance.
 *
 * Philosophy (see Chapter 9, Chapter 2): deterministic tools catch what code review misses.
 * These rules are enforced at zero-warnings tolerance via `npm run lint:strict`.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Stricter TypeScript rules on top of what eslint-config-next provides.
  // Plugin is already registered by nextTs — we only add/override rules here.
  {
    files: ["src/**/*.{ts,tsx}", "mcp/**/*.ts", "scripts/**/*.ts"],
    rules: {
      // No silent `any` — every any must be intentional
      "@typescript-eslint/no-explicit-any": "error",
      // Dead code surfaces quickly
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Consistent type imports reduce bundle risk
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
      // No non-null assertions — use proper guards instead
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },

  // Accessibility rules — jsx-a11y plugin already registered by nextVitals
  {
    files: ["src/**/*.{tsx,jsx}"],
    rules: {
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/anchor-is-valid": "error",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "public/ffmpeg-core/**",
    "release/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
