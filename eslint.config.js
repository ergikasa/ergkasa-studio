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
      // throwaway prototypes (character v3/v4, the format spike): evidence for decisions, not production code
      "prototypes/**",
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
            {
              group: ["@erkasa/character/library", "@erkasa/character/builder"],
              message:
                "Engines take characters only from the render package (Character System V1), never from the Library.",
            },
          ],
        },
      ],
    },
  },
  {
    // Character System V1: the Gate and the legacy engine read characters through packages, not the Library
    files: ["gate/**/*.ts", "engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@erkasa/character/library", "@erkasa/character/builder"],
              message: "Characters come through the render package, never from the Library or the Builder.",
            },
          ],
        },
      ],
    },
  },
  {
    // the Character Runtime executes packages: it neither finds them (Library) nor makes them (Builder)
    files: ["character/src/runtime/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../library/*", "../builder/*"],
              message: "The Runtime does not use the Library or the Builder.",
            },
          ],
        },
      ],
    },
  },
);
