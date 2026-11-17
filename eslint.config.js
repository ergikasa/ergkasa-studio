import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "backend/**",
      "assets/**",
      "tools/**",
      "contracts/json-schema/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    // Engine boundary (E0): the film engine executes plans; it never plans, never calls a model.
    files: ["film/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@erkasa/planner", "@erkasa/planner/*"],
              message: "The engine must not depend on the planning layer.",
            },
            {
              group: ["@erkasa/ai-worker", "@erkasa/ai-worker/*", "@erkasa/studio", "@erkasa/studio/*"],
              message: "The engine must not depend on the worker or the UI.",
            },
            {
              group: ["@anthropic-ai/*", "openai", "openai/*", "**/llm", "**/llm.js"],
              message: "The engine must not call a language model.",
            },
          ],
        },
      ],
    },
  },
);
