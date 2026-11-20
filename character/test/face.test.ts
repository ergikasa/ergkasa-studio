import { describe, expect, it } from "vitest";
import { evaluate, type Evaluated, type IrisItem, type PartItem } from "../src/runtime/index.js";
import { testCharacter, must } from "./helpers.js";

const item = (ev: Evaluated, id: string): PartItem => {
  for (const l of ev.layers) for (const it of l.items) if (it.kind === "part" && it.part.id === id) return it;
  throw new Error(`${id} not drawn`);
};
const iris = (ev: Evaluated, eye: "l" | "r"): IrisItem => {
  for (const l of ev.layers) for (const it of l.items) if (it.kind === "iris" && it.eye.id === eye) return it;
  throw new Error(`no iris ${eye}`);
};
const meanY = (it: PartItem, idx: number[]): number =>
  idx.reduce((s, i) => s + (it.points[i * 2 + 1] as number), 0) / idx.length;
const area = (it: PartItem): number => {
  if (it.part.kind !== "vector") return 0;
  const idx = must(it.part.paths[0]).cmds.flatMap((c) => c.slice(1) as number[]);
  let a = 0;
  for (let i = 0; i < idx.length; i++) {
    const p = idx[i] as number;
    const q = idx[(i + 1) % idx.length] as number;
    a +=
      (it.points[p * 2] as number) * (it.points[q * 2 + 1] as number) -
      (it.points[q * 2] as number) * (it.points[p * 2 + 1] as number);
  }
  return Math.abs(a) / 2;
};

describe("basic facial controls", () => {
  it("au12 lifts the mouth corners", async () => {
    const c = await testCharacter();
    const rest = item(evaluate(c, { channels: {} }), "mouth_front");
    const smile = item(evaluate(c, { channels: { au12: 1 } }), "mouth_front");
    // corners: the first and fifth outline anchors (builder order)
    expect(meanY(smile, [0, 4])).toBeLessThan(meanY(rest, [0, 4]) - 4);
  });

  it("au01 lifts the inner brows, au04 lowers them", async () => {
    const c = await testCharacter();
    const y = (ch: Record<string, number>): number =>
      meanY(item(evaluate(c, { channels: ch }), "brow_l_front"), [0]);
    expect(y({ au01: 1 })).toBeLessThan(y({}) - 5);
    expect(y({ au04: 1 })).toBeGreaterThan(y({}) + 4);
  });

  it("jaw_open drops the chin and shows the inside of the mouth", async () => {
    const c = await testCharacter();
    const rest = evaluate(c, { channels: {} });
    const open = evaluate(c, { channels: { jaw_open: 1 } });
    expect(item(rest, "mouth_inside_front").opacity).toBe(0);
    expect(item(open, "mouth_inside_front").opacity).toBe(1);
    const chinY = (ev: Evaluated): number =>
      Math.max(...Array.from(item(ev, "head_front").points).filter((_, i) => i % 2 === 1));
    expect(chinY(open)).toBeGreaterThan(chinY(rest) + 15);
  });

  it("blink: lid_l closes the left eye's opening, the right one stays open", async () => {
    const c = await testCharacter();
    const rest = evaluate(c, { channels: {} });
    const shut = evaluate(c, { channels: { lid_l: 1 } });
    expect(area(item(shut, "eye_white_l_front"))).toBeLessThan(area(item(rest, "eye_white_l_front")) * 0.1);
    expect(area(item(shut, "eye_white_r_front"))).toBeCloseTo(area(item(rest, "eye_white_r_front")), 9);
  });
});

describe("eye tracking", () => {
  it("both irises turn toward a target on the right", async () => {
    const c = await testCharacter();
    const rest = evaluate(c, { channels: {} });
    const right = evaluate(c, { channels: { gaze_x: 200 } });
    for (const e of ["l", "r"] as const)
      expect(iris(right, e).center[0]).toBeGreaterThan(iris(rest, e).center[0] + 2);
  });

  it("a near target makes the eyes converge", async () => {
    const c = await testCharacter();
    const near = evaluate(c, { channels: { gaze_z: 60 } });
    const far = evaluate(c, { channels: { gaze_z: 3000 } });
    // the left eye (screen right) turns toward the middle (−x), the right eye toward +x
    expect(iris(near, "l").center[0]).toBeLessThan(iris(far, "l").center[0] - 2);
    expect(iris(near, "r").center[0]).toBeGreaterThan(iris(far, "r").center[0] + 2);
  });

  it("the eye turns at most maxAngle: past it, the iris stays where it is", async () => {
    const c = await testCharacter();
    const a = iris(evaluate(c, { channels: { gaze_x: 400, gaze_z: 100 } }), "l").center[0];
    const b = iris(evaluate(c, { channels: { gaze_x: 500, gaze_z: 60 } }), "l").center[0];
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });

  it("the iris rolls with the head", async () => {
    const c = await testCharacter();
    const rest = iris(evaluate(c, { channels: { gaze_x: 300 } }), "l");
    const rolled = iris(evaluate(c, { channels: { gaze_x: 300, head_roll: 15 } }), "l");
    expect(rolled.angle).toBeCloseTo(rest.angle + 15, 6);
  });
});

describe("head views and angles", () => {
  it("head_yaw selects the view whose range holds it", async () => {
    const c = await testCharacter();
    expect(evaluate(c, { channels: { head_yaw: 0 } }).layers.map((l) => l.views["head"])).toEqual(["front"]);
    expect(evaluate(c, { channels: { head_yaw: 30 } }).layers.map((l) => l.views["head"])).toEqual(["q3"]);
  });

  it("inside the blend band both views are drawn, cross-faded, weights summing to 1", async () => {
    const c = await testCharacter();
    const ev = evaluate(c, { channels: { head_yaw: 14 } });
    expect(ev.layers.map((l) => l.views["head"])).toEqual(["front", "q3"]);
    expect(ev.layers.reduce((s, l) => s + l.weight, 0)).toBeCloseTo(1, 12);
    expect(must(ev.layers[1]).weight).toBeCloseTo((14 - 12) / 6, 12);
  });

  it("inside a view, the angle morphs turn the features with the yaw", async () => {
    const c = await testCharacter();
    const x = (yaw: number): number =>
      item(evaluate(c, { channels: { head_yaw: yaw } }), "mouth_front").points[0] as number;
    expect(x(10)).toBeGreaterThan(x(0) + 5);
    expect(x(-10)).toBeLessThan(x(0) - 5);
  });

  it("refuses a yaw outside the views (the package covers −15…40)", async () => {
    const c = await testCharacter();
    expect(() => evaluate(c, { channels: { head_yaw: 60 } })).toThrow(/CHANNEL_RANGE/);
  });
});
