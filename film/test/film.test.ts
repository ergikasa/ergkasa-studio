import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { FilmPlan } from "../src/contract.js";
import { frameAt } from "../src/compose.js";
import { prepare } from "../src/film.js";
import { rasterize } from "../src/render.js";

const root = join(import.meta.dirname, "..", "..");
const load = (name: string) => ({
  script: Script.parse(
    JSON.parse(readFileSync(join(root, "benchmark", "scripts", `${name}.script.json`), "utf8")),
  ),
  plan: FilmPlan.parse(JSON.parse(readFileSync(join(root, "film", "plans", `${name}.film.json`), "utf8"))),
});
const plans = readdirSync(join(root, "film", "plans")).map((f) => f.replace(".film.json", ""));

describe("hand-directed benchmark plans", () => {
  for (const name of plans)
    it(`${name}: no errors, no shot over 7.5 s, no dead time`, () => {
      const { issues, composed } = prepare(load(name));
      expect(issues.filter((i) => i.level === "error")).toEqual([]);
      for (const s of composed.shots) expect(s.dur).toBeLessThanOrEqual(7.5);
    });
});

describe("quality checks", () => {
  const base = load("b1-why-we-stay");
  it("a shot that is too long is an error with a fix", () => {
    const plan = FilmPlan.parse({
      ...base.plan,
      shots: base.plan.shots.filter((s) => !["sh10", "sh11"].includes(s.id)),
    });
    const codes = prepare({ ...base, plan }).issues.map((i) => i.code);
    expect(codes).toContain("SHOT_TOO_LONG");
  });
  it("the same place, subject and framing twice in a row is a jump cut", () => {
    const shots = base.plan.shots.map((s) =>
      s.id === "sh03" ? { ...s, framing: "medium" as const, subject: "dritan" } : s,
    );
    const codes = prepare({ ...base, plan: FilmPlan.parse({ ...base.plan, shots }) }).issues.map(
      (i) => i.code,
    );
    expect(codes).toContain("SAME_FRAMING");
  });
  it("a shot starting at a word that is not spoken there is reported", () => {
    const shots = base.plan.shots.map((s) => (s.id === "sh04" ? { ...s, from: "word:elephant" } : s));
    const codes = prepare({ ...base, plan: FilmPlan.parse({ ...base.plan, shots }) }).issues.map(
      (i) => i.code,
    );
    expect(codes).toContain("SHOT_START");
  });
});

describe("rendering", () => {
  it("every shot of every benchmark plan rasterises (first, middle and last frame)", () => {
    for (const name of plans) {
      const { composed } = prepare(load(name));
      composed.shots.forEach((s, i) => {
        for (const f of [0, Math.round(s.dur * 15), Math.max(0, Math.round(s.dur * 30) - 1)]) {
          const px = rasterize(frameAt(composed, i, f));
          expect(px.length).toBe(1080 * 1920 * 4);
        }
      });
    }
  }, 120_000);
});
