import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDITORIAL_BEATS, Script } from "../src/index.js";
import { REPO_ROOT } from "./helpers.js";

/**
 * The benchmark scripts are frozen inputs: every version of the studio renders the same five, so the videos can
 * be compared over time. They must stay valid scripts and keep covering the five kinds of film.
 */
const dir = join(REPO_ROOT, "benchmark", "scripts");
const files = readdirSync(dir).filter((f) => f.endsWith(".script.json"));

describe("benchmark scripts", () => {
  it("there are five, one per kind of film", () => {
    expect(files.map((f) => f.split("-")[0]).sort()).toEqual(["b1", "b2", "b3", "b4", "b5"]);
  });

  for (const file of files) {
    it(`${file} is a valid editorial script`, () => {
      const res = Script.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
      expect(res.success, res.success ? "" : JSON.stringify(res.error.issues)).toBe(true);
      if (!res.success) return;
      for (const s of res.data.scenes) expect(EDITORIAL_BEATS).toContain(s.beat);
      expect(res.data.estimatedSec).toBeGreaterThanOrEqual(25);
      expect(res.data.estimatedSec).toBeLessThanOrEqual(60);
    });
  }
});
