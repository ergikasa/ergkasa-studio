import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Script } from "@erkasa/contracts";
import { parsePlan, prepare } from "../src/w0/composer.js";
import { measure } from "../src/w0/mechanics.js";
import { solveLeg } from "../src/perform.js";
import { skeleton } from "../src/rig.js";
import { STANDING } from "../src/rig.js";

const script = Script.parse(JSON.parse(readFileSync(new URL("../../benchmark/scripts/b1-why-we-stay.script.json", import.meta.url), "utf8")));
const plan = parsePlan(JSON.parse(readFileSync(new URL("../w0/plan.json", import.meta.url), "utf8")));

describe("body mechanics (W0 benchmark film)", () => {
  const m = measure(prepare(plan, script));
  it("the foot that carries the weight does not slide", () => {
    expect(m.footSlideMaxPx).toBeLessThanOrEqual(5);
    expect(m.footSlideMeanPx).toBeLessThanOrEqual(1);
  });
  it("walks start and stop without a jump in speed", () => expect(m.jerkMaxPx).toBeLessThanOrEqual(10));
  it("a turn never flattens the body into a sheet", () => expect(m.turnMinWidth).toBeGreaterThanOrEqual(0.5));
  it("a sad walk is clearly slower than a determined one", () =>
    expect((m.speedByMood["sad"] ?? 0) / (m.speedByMood["determined"] ?? 1)).toBeLessThan(0.75));
});

describe("leg IK", () => {
  it("puts the ankle on a reachable target", () => {
    const target: [number, number] = [60, 300];
    const leg = solveLeg([6, 0], target);
    const sk = skeleton({ ...STANDING, thigh: leg.thigh, shin: leg.shin });
    expect(Math.hypot(sk.ankle[0] - target[0], sk.ankle[1] - target[1])).toBeLessThan(0.5);
  });
});
