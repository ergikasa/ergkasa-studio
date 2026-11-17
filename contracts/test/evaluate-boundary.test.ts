/** The evaluator is pure: no I/O, clock, randomness or dependency beyond the contract's own types. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACTS_DIR } from "./helpers.js";

describe("evaluate.ts boundary", () => {
  const src = readFileSync(join(CONTRACTS_DIR, "src/evaluate.ts"), "utf8");
  it("imports only the contract's types", () => {
    const imports = [...src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gm)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(imports).toEqual([["type ", "./render-package.js"]]);
  });
  it("uses no file system, network, clock, randomness or process state", () => {
    for (const bad of [
      /"node:/,
      /require\(/,
      /import\(/,
      /fetch\(/,
      /Date\b/,
      /Math\.random/,
      /process\./,
      /globalThis/,
    ])
      expect(bad.test(src), String(bad)).toBe(false);
  });
});
