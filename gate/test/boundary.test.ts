/** The gate depends only on the contracts: no engine, stager, planner or model code in its source. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./helpers.js";

describe("boundary", () => {
  it("runtime dependencies: @erkasa/contracts only", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "gate/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).toEqual(["@erkasa/contracts"]);
  });

  it("source imports: the contracts, node built-ins and its own files only; no network, clock or randomness", () => {
    for (const f of readdirSync(join(ROOT, "gate/src"))) {
      const src = readFileSync(join(ROOT, "gate/src", f), "utf8");
      for (const m of src.matchAll(/from "([^"]+)"/g)) {
        const spec = m[1] as string;
        expect(
          spec === "@erkasa/contracts" || spec.startsWith("node:") || spec.startsWith("./"),
          `${f}: ${spec}`,
        ).toBe(true);
      }
      for (const bad of [/node:https?/, /fetch\(/, /Math\.random/, /Date\.now/, /new Date\(/])
        expect(bad.test(src), `${f}: ${bad}`).toBe(false);
    }
  });
});
