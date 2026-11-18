/**
 * The Claude API refuses a structured-output schema with more than 16 union-typed parameters (nullable fields,
 * anyOf, type arrays): "Schemas contains too many parameters with union types". Every schema the worker sends
 * stays within it.
 */
import { DIRECTOR_SCHEMA } from "@erkasa/planner";
import { describe, expect, it } from "vitest";
import { DRAFT_SCHEMA } from "../src/plan-draft.js";
import { SCRIPT_SCHEMA } from "../src/script-writer.js";

const API_UNION_LIMIT = 16;

function unions(schema: unknown): number {
  let n = 0;
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (Array.isArray(o["type"]) || Array.isArray(o["anyOf"]) || Array.isArray(o["oneOf"])) n++;
    Object.values(o).forEach(walk);
  };
  walk(schema);
  return n;
}

describe("structured-output schemas", () => {
  it.each([
    ["the film director (visual plan)", DIRECTOR_SCHEMA],
    ["the script writer", SCRIPT_SCHEMA],
    ["the v1 visual plan draft", DRAFT_SCHEMA],
  ])("%s: at most 16 union-typed parameters", (_, schema) => {
    expect(unions(schema)).toBeLessThanOrEqual(API_UNION_LIMIT);
  });
});
