/**
 * Architecture boundaries, checked on the source:
 *   - the Runtime imports neither the Library nor the Builder (it executes packages, it does not find or make them)
 *   - nothing of @erkasa/character imports an Engine or the planning layer
 *   - no Engine code (film/, which holds the four Engines, and the renderer) imports the Library or the Builder
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : files(p);
    return /\.(ts|mjs|js)$/.test(e.name) ? [p] : [];
  });
const imports = (file: string): string[] =>
  [
    ...readFileSync(file, "utf8").matchAll(
      /(?:import|export)[^"']*from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g,
    ),
  ].map((m) => (m[1] ?? m[2]) as string);

describe("boundaries", () => {
  it("the Runtime does not import the Library or the Builder", () => {
    for (const f of files(join(ROOT, "character", "src", "runtime")))
      for (const i of imports(f)) expect(i, f).not.toMatch(/\.\.\/(library|builder)\//);
  });

  it("@erkasa/character imports no Engine and no planning code", () => {
    for (const f of files(join(ROOT, "character", "src")))
      for (const i of imports(f))
        expect(i, f).not.toMatch(
          /@erkasa\/(film|stager|compiler|engine|engine-worker|planner|ai-worker|gate)|\.\.\/\.\.\/\.\.\/(film|stager|gate)/,
        );
  });

  it("no Engine code reads the Library or uses the Builder", () => {
    for (const pkg of ["film", "gate", "engine", "stager", "compiler"])
      for (const f of files(join(ROOT, pkg, "src")))
        for (const i of imports(f)) expect(i, f).not.toMatch(/@erkasa\/character\/(library|builder)/);
  });
});
