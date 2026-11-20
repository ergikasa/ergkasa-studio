import { describe, expect, it } from "vitest";
import { evaluate, type Evaluated, type PartItem } from "../src/runtime/index.js";
import { maxAbsDiff, testCharacter, must } from "./helpers.js";

const partItem = (ev: Evaluated, id: string): PartItem => {
  for (const l of ev.layers) for (const it of l.items) if (it.kind === "part" && it.part.id === id) return it;
  throw new Error(`${id} not drawn`);
};
const restOf = (it: PartItem): number[] => it.part.vertices.flat();

describe("skeleton initialisation", () => {
  it("at rest every part is exactly its authored geometry (skin matrices are the identity)", async () => {
    const c = await testCharacter();
    const ev = evaluate(c, { channels: {}, outfit: "test_tee" });
    for (const l of ev.layers)
      for (const it of l.items)
        if (it.kind === "part") expect(maxAbsDiff(it.points, restOf(it))).toBeLessThan(1e-9);
  });

  it("sockets start where the package declares them", async () => {
    const c = await testCharacter();
    const ev = evaluate(c, { channels: {} });
    expect(ev.sockets.get("hand_l")?.[0]).toBeCloseTo(150, 9);
    expect(ev.sockets.get("hand_l")?.[1]).toBeCloseTo(6, 9);
  });

  it("forward kinematics: raising the upper arm 90° turns the hand about the shoulder joint", async () => {
    const c = await testCharacter();
    const ev = evaluate(c, { channels: { arm_l_upper: 90 } });
    // the hand socket (150, 6) turns 90° counter-clockwise about the joint (150, −400): (556, −400)
    const s = ev.sockets.get("hand_l") as [number, number];
    expect(s[0]).toBeCloseTo(556, 6);
    expect(s[1]).toBeCloseTo(-400, 6);
  });

  it("children follow their parents: bending the spine moves the head and both hands", async () => {
    const c = await testCharacter();
    const rest = evaluate(c, { channels: {} });
    const bent = evaluate(c, { channels: { spine_bend: 10 } });
    for (const id of ["hand_l", "hand_r"])
      expect(
        Math.hypot(
          must(bent.sockets.get(id))[0] - must(rest.sockets.get(id))[0],
          must(bent.sockets.get(id))[1] - must(rest.sockets.get(id))[1],
        ),
      ).toBeGreaterThan(5);
    expect(
      maxAbsDiff(partItem(bent, "head_front").points, partItem(rest, "head_front").points),
    ).toBeGreaterThan(10);
  });
});

describe("mesh deformation", () => {
  it("skinned elbow: vertices at the elbow move between the upper arm and the forearm (no rigid break)", async () => {
    const c = await testCharacter();
    const rest = partItem(evaluate(c, { channels: {} }), "arm_l");
    const bent = partItem(evaluate(c, { channels: { arm_l_lower: 90 } }), "arm_l");
    const part = rest.part;
    if (part.binding.kind !== "skin") throw new Error("arm_l is skinned");
    const moved = (i: number): number =>
      Math.hypot(
        (bent.points[i * 2] as number) - (rest.points[i * 2] as number),
        (bent.points[i * 2 + 1] as number) - (rest.points[i * 2 + 1] as number),
      );
    const upper = part.binding.bones.indexOf("arm_l_upper");
    const lower = part.binding.bones.indexOf("arm_l_lower");
    const byWeight = (pred: (wu: number, wl: number) => boolean): number[] =>
      part.binding.kind === "skin"
        ? part.binding.weights.flatMap((ws, i) => {
            const wu = ws.find(([b]) => b === upper)?.[1] ?? 0;
            const wl = ws.find(([b]) => b === lower)?.[1] ?? 0;
            return pred(wu, wl) ? [i] : [];
          })
        : [];
    const onlyUpper = byWeight((wu, wl) => wu > 0.999 && wl === 0);
    const blended = byWeight((wu, wl) => wu > 0.2 && wl > 0.2);
    const onlyLower = byWeight((wu, wl) => wl > 0.999 && wu === 0);
    expect(onlyUpper.length && blended.length && onlyLower.length).toBeTruthy();
    for (const i of onlyUpper) expect(moved(i)).toBeLessThan(1e-9);
    const mid = Math.max(...blended.map(moved));
    const far = Math.max(...onlyLower.map(moved));
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(far);
  });

  it("texture mesh: the T-shirt's vertices follow the spine and chest", async () => {
    const c = await testCharacter();
    const rest = partItem(evaluate(c, { channels: {}, outfit: "test_tee" }), "tee");
    const bent = partItem(
      evaluate(c, { channels: { spine_bend: 10, chest_bend: 5 }, outfit: "test_tee" }),
      "tee",
    );
    expect(rest.part.kind).toBe("texture");
    expect(maxAbsDiff(bent.points, rest.points)).toBeGreaterThan(20);
  });

  it("morph targets add their deltas at the drive's weight (breath at 0.5 = half the displacement)", async () => {
    const c = await testCharacter();
    const rest = partItem(evaluate(c, { channels: {} }), "torso_skin");
    const half = partItem(evaluate(c, { channels: { breath: 0.5 } }), "torso_skin");
    const full = partItem(evaluate(c, { channels: { breath: 1 } }), "torso_skin");
    const d = (a: PartItem, b: PartItem): number[] =>
      Array.from(a.points, (v, i) => v - (b.points[i] as number));
    const dh = d(half, rest);
    const df = d(full, rest);
    expect(
      maxAbsDiff(
        dh.map((v) => v * 2),
        df,
      ),
    ).toBeLessThan(1e-9);
    expect(Math.max(...df.map(Math.abs))).toBeGreaterThan(3);
  });

  it("the outfit adds its garments and hides what it covers", async () => {
    const c = await testCharacter();
    const ids = (outfit?: string): string[] =>
      must(evaluate(c, { channels: {}, outfit }).layers[0]).items.flatMap((it) =>
        it.kind === "part" ? [it.part.id] : [],
      );
    expect(ids()).toContain("torso_skin");
    expect(ids()).not.toContain("tee");
    expect(ids("test_tee")).toContain("tee");
    expect(ids("test_tee")).not.toContain("torso_skin");
  });
});

describe("commands are executed, never corrected", () => {
  it("refuses a channel the character does not consume", async () => {
    const c = await testCharacter();
    expect(() => evaluate(c, { channels: { leg_l_upper: 10 } })).toThrow(/CHANNEL_UNKNOWN/);
  });
  it("refuses a value outside the control's range", async () => {
    const c = await testCharacter();
    expect(() => evaluate(c, { channels: { arm_l_lower: 200 } })).toThrow(/CHANNEL_RANGE/);
  });
  it("refuses an outfit the package does not have", async () => {
    const c = await testCharacter();
    expect(() => evaluate(c, { channels: {}, outfit: "tuxedo" })).toThrow(/OUTFIT_UNKNOWN/);
  });
  it("is deterministic: the same commands give the same numbers", async () => {
    const c = await testCharacter();
    const ch = { arm_l_upper: 33.3, head_yaw: 14, au12: 0.4, gaze_x: 120 };
    const a = evaluate(c, { channels: ch, outfit: "test_tee" });
    const b = evaluate(c, { channels: ch, outfit: "test_tee" });
    expect(
      JSON.stringify(
        a.layers.map((l) => l.items.map((it) => (it.kind === "part" ? Array.from(it.points) : it.center))),
      ),
    ).toBe(
      JSON.stringify(
        b.layers.map((l) => l.items.map((it) => (it.kind === "part" ? Array.from(it.points) : it.center))),
      ),
    );
  });
});
