/* chr_daniel@1, the first reference character built from approved art (a candidate: written to the library,
 * verified, not published until the PO approves it). */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_ROOT, readCatalog, verifyPackage } from "../src/library/index.js";
import {
  evaluate,
  loadCharacter,
  RUNTIME_REVISION,
  type Evaluated,
  type LoadedCharacter,
  type PartItem,
} from "../src/runtime/index.js";
import { maxAbsDiff, must } from "./helpers.js";

const DIR = join(LIBRARY_ROOT, "characters", "chr_daniel", "1");
let cached: Promise<LoadedCharacter> | undefined;
const daniel = (): Promise<LoadedCharacter> => (cached ??= loadCharacter(DIR));

const item = (ev: Evaluated, id: string): PartItem => {
  for (const l of ev.layers) for (const it of l.items) if (it.kind === "part" && it.part.id === id) return it;
  throw new Error(`${id} not drawn`);
};
/** Area of a vector part's first path, its points in command order (anchors and handles). */
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

describe("chr_daniel@1 (candidate)", () => {
  it("is a verified package whose every declared capability has an effect, awaiting the PO", async () => {
    const { character, findings } = await verifyPackage(DIR);
    expect(findings.filter((f) => f.level === "error")).toEqual([]);
    const m = character.manifest;
    expect(m.purpose).toBe("reference");
    expect(m.approval.status).toBe("pending");
    expect(m.compatibility.minRuntime).toBeLessThanOrEqual(RUNTIME_REVISION);
    expect(readCatalog().characters.some((e) => e.id === "chr_daniel")).toBe(false);
    expect(m.capabilities.views).toEqual({
      head: ["hn45", "hn30", "hn15", "h0", "h15", "h30", "h45"],
      body: ["b0", "b35"],
    });
  });

  it("selects the head and body views from their channels; inside a band two layers cross-fade", async () => {
    const c = await daniel();
    const views = (ch: Record<string, number>) => evaluate(c, { channels: ch }).layers.map((l) => l.views);
    expect(views({ head_yaw: 30, body_yaw: 35 })).toEqual([{ head: "h30", body: "b35" }]);
    expect(views({ head_yaw: -45 })).toEqual([{ head: "hn45", body: "b0" }]);
    const band = evaluate(c, { channels: { head_yaw: 7.5 } }).layers;
    expect(band.map((l) => l.views["head"])).toEqual(["h0", "h15"]);
    expect(band.reduce((s, l) => s + l.weight, 0)).toBeCloseTo(1);
  });

  it("speaks: a viseme opens the mouth through the jaw and its units", async () => {
    const c = await daniel();
    const shut = area(item(evaluate(c, { channels: {} }), "mouth_inside_h0"));
    const aa = evaluate(c, { channels: { viseme_aa: 1 } });
    expect(aa.values["jaw_open"]).toBeCloseTo(0.75);
    expect(shut).toBeLessThan(1);
    expect(area(item(aa, "mouth_inside_h0"))).toBeGreaterThan(200);
    // the open mouth's outline fades in with the jaw
    expect(item(evaluate(c, { channels: {} }), "mouth_open_line_h0").opacity).toBe(0);
    expect(item(aa, "mouth_open_line_h0").opacity).toBe(1);
  });

  it("expression lines come with the units that make them", async () => {
    const c = await daniel();
    const o = (ch: Record<string, number>, id: string) => item(evaluate(c, { channels: ch }), id).opacity;
    expect(o({}, "frown_lines_h0")).toBe(0);
    expect(o({ au04: 1 }, "frown_lines_h0")).toBe(1);
    expect(o({ au12: 1 }, "smile_lines_h0")).toBe(1);
    expect(o({ au01: 1 }, "forehead_worry_h0")).toBe(1);
  });

  it("an arm channel moves that arm's chain in the view drawn, and only that arm", async () => {
    const c = await daniel();
    for (const body of [0, 35]) {
      const v = body === 0 ? "b0" : "b35";
      const rest = evaluate(c, { channels: { body_yaw: body } });
      const raised = evaluate(c, { channels: { body_yaw: body, arm_l_lower: 90 } });
      expect(
        maxAbsDiff(item(rest, `hand_l_${v}`).points, item(raised, `hand_l_${v}`).points),
      ).toBeGreaterThan(50);
      expect(maxAbsDiff(item(rest, `hand_r_${v}`).points, item(raised, `hand_r_${v}`).points)).toBe(0);
    }
  });

  it("is deterministic: the same channels give the same geometry", async () => {
    const c = await daniel();
    const ch = { head_yaw: 22, head_pitch: -4, au12: 0.6, viseme_oh: 0.5, arm_r_lower: 40, breath: 0.3 };
    const a = evaluate(c, { channels: ch });
    const b = evaluate(c, { channels: ch });
    expect(maxAbsDiff(item(a, "head_h15").points, item(b, "head_h15").points)).toBe(0);
  });
});
