/**
 * The gate depends only on the contracts and on saxes (the XML parser of SVG_UNSAFE, pinned to one exact version;
 * E1.4 decision B4): no engine, stager, planner or model code in its source.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./helpers.js";

describe("boundary", () => {
  it("runtime dependencies: @erkasa/contracts and saxes (exact version), nothing else (E1.4 decision B4)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "gate/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies).toEqual({ "@erkasa/contracts": "workspace:*", saxes: "6.0.0" });
  });

  it("source imports: the contracts, saxes, node built-ins and its own files only; no network, clock or randomness", () => {
    for (const f of readdirSync(join(ROOT, "gate/src"))) {
      const src = readFileSync(join(ROOT, "gate/src", f), "utf8");
      for (const m of src.matchAll(/from "([^"]+)"/g)) {
        const spec = m[1] as string;
        expect(
          spec === "@erkasa/contracts" ||
            spec === "saxes" ||
            spec.startsWith("node:") ||
            spec.startsWith("./"),
          `${f}: ${spec}`,
        ).toBe(true);
      }
      for (const bad of [/node:https?/, /fetch\(/, /Math\.random/, /Date\.now/, /new Date\(/])
        expect(bad.test(src), `${f}: ${bad}`).toBe(false);
    }
  });
});
