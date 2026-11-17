/**
 * V2 (E1.4) with decision B: every view a scene's camera takes, as the engine draws it (the rounded numbers of its
 * view transform), checked against bounds without tolerance. Boundary tests for samples, keys (linear, hold,
 * clamped ends), mixed tracks, touching and one-step-outside bounds, and the views the rounding makes.
 */
import { describe, expect, it } from "vitest";
import {
  cameraViews,
  drawn,
  enclose,
  evaluate,
  outside,
  project,
  round2,
  transformAttr,
  viewOf,
  type Lens,
  type RenderPackage,
  type ViewRect,
} from "../src/index.js";

type Scene = RenderPackage["scenes"][number];
type Track = Scene["tracks"][number];
const W = 1080;
const H = 1920;
const cam = (channel: string, t: Omit<Track, "target" | "channel">): Track =>
  ({ target: { kind: "camera" }, channel, ...t }) as Track;
const scene = (...tracks: Track[]): Scene => ({ id: "s", tracks }) as unknown as Scene;
const samples = (values: number[], start = 0): Omit<Track, "target" | "channel"> =>
  ({ kind: "samples", start, rate: 30, values }) as never;
const keys = (...k: Array<[number, number, "linear" | "hold"]>): Omit<Track, "target" | "channel"> =>
  ({ kind: "keys", keys: k.map(([t, v, ease]) => ({ t, v, ease })) }) as never;
const nextUp = (v: number): number => {
  const b = new Float64Array([v]);
  const i = new BigInt64Array(b.buffer);
  i[0] = (i[0] as bigint) + (v >= 0 ? 1n : -1n);
  return b[0] as number;
};
const nextDown = (v: number): number => -nextUp(-v);
const ulp = (v: number): number => nextUp(Math.abs(v)) - Math.abs(v);
const SET: Lens = { kind: "set" };
const hull = (vs: ViewRect[]) => ({
  x: Math.min(...vs.map((v) => v.x0)),
  y: Math.min(...vs.map((v) => v.y0)),
  r: Math.max(...vs.map((v) => v.x1)),
  b: Math.max(...vs.map((v) => v.y1)),
});
const anyOutside = (s: Scene, bounds: Scene["bounds"]): boolean =>
  (cameraViews(s, W, H, SET) ?? []).some((v) => outside(bounds, v).length > 0);

describe("the view (flat set, editorial at x = W/2, parallax at the actors' plane)", () => {
  it("the numbers are the engine's: 2 decimals for a set and an editorial view, 5 and 3 for W0", () => {
    expect(drawn(SET, 540.004, 960.005, 2140, W, H)).toEqual({
      ox: "540",
      oy: "960",
      s: "0.9",
      tx: "-540",
      ty: "-960",
    });
    expect(drawn({ kind: "editorial" }, 999, 900, 1600, W, H)).toEqual({
      ox: "540",
      oy: String(round2(960 + (960 - 900) * (1920 / 1600))),
      s: "1.2",
      tx: "-540",
      ty: "-960",
    });
    const ref = { cx: 1450, cy: 1120, height: 2140 };
    const p = project({ cx: 1000.12345, cy: 900, height: 1777 }, 0, ref, 0.55, H);
    const d = drawn({ kind: "parallax", reference: ref, gamma: 0.55, plane: 0 }, 1000.12345, 900, 1777, W, H);
    expect(d).toEqual({
      ox: "540",
      oy: "960",
      s: p.s.toFixed(5),
      tx: (-p.cx).toFixed(3),
      ty: (-p.cy).toFixed(3),
    });
    expect(transformAttr(d)).toBe(`translate(540 960) scale(${d.s}) translate(${d.tx} ${d.ty})`);
  });

  it("the view is the world those numbers put in the frame (a set at h = 1920 is exact)", () => {
    expect(viewOf(drawn(SET, 540, 960, 1920, W, H), W, H)).toEqual({
      t: 0,
      x0: 0,
      x1: 1080,
      y0: 0,
      y1: 1920,
    });
    // h = 3840: scale 0.5, so 2160 × 3840 around the written centre (1000.12, −700.5)
    expect(viewOf(drawn(SET, 1000.12, -700.5, 3840, W, H), W, H)).toEqual({
      t: 0,
      x0: -1080 + 1000.12,
      x1: 1080 + 1000.12,
      y0: -1920 - 700.5,
      y1: 1920 - 700.5,
    });
  });

  it("differs from the exact formula by the rounding, and that is what is checked", () => {
    // h = 2140: H/h = 0.8972 is written 0.9, so the set view is 600 wide each side, not 601.875
    const v = viewOf(drawn(SET, 1000, 960, 2140, W, H), W, H);
    expect(v.x1 - 1000).toBe(540 / 0.9);
    expect(v.x1 - 1000).not.toBe((2140 * W) / H / 2);
  });

  it("bounds touching the view exactly pass; one representable step inside on any side fails", () => {
    const s = scene(
      cam("x", keys([0, 540, "hold"])),
      cam("y", keys([0, 960, "hold"])),
      cam("height", keys([0, 1920, "hold"])),
    );
    const b = { x: 0, y: 0, w: 1080, h: 1920 };
    expect(anyOutside(s, b)).toBe(false);
    expect(anyOutside(s, { ...b, x: nextUp(0) })).toBe(true);
    expect(anyOutside(s, { ...b, y: nextUp(0) })).toBe(true);
    expect(anyOutside(s, { ...b, w: nextDown(1080) })).toBe(true);
    expect(anyOutside(s, { ...b, h: nextDown(1920) })).toBe(true);
  });
});

describe("every instant the camera can take", () => {
  const still = [cam("y", keys([0, 960, "hold"])), cam("height", keys([0, 1920, "hold"]))];
  const b = { x: 0, y: 0, w: 1080, h: 1920 };

  it("samples: one sample outside in the middle of the track is found", () => {
    expect(anyOutside(scene(cam("x", samples([540, 540, 541, 540, 540])), ...still), b)).toBe(true);
    expect(anyOutside(scene(cam("x", samples([540, 540, 540, 540, 540])), ...still), b)).toBe(false);
  });

  it("samples: the last sample (after the last rendered frame too) is found", () => {
    expect(anyOutside(scene(cam("x", samples([540, 540, 540, 539.5])), ...still), b)).toBe(true);
  });

  it("samples: an eased overshoot stored in the samples is found", () => {
    // ease-out-back towards 540 overshoots to 540.8 before settling
    expect(anyOutside(scene(cam("x", samples([500, 530, 540.8, 540.2, 540])), ...still), b)).toBe(true);
  });

  it("keys: a linear zoom whose exact view stays inside leaves the bounds as drawn (rounded scale)", () => {
    // exact: y ± h/2 from 900 ± 900 to 960 ± 960, inside [0, 1920]. Drawn: at h ≈ 1805 the scale 1.0637 is
    // written 1.06, a view 1811 tall around y ≈ 903: its top is below 0.
    const s = scene(
      cam("x", keys([0, 540, "linear"], [1, 540, "linear"])),
      cam("y", keys([0, 900, "linear"], [1, 960, "linear"])),
      cam("height", keys([0, 1800, "linear"], [1, 1920, "linear"])),
    );
    expect(anyOutside(s, { x: 0, y: 0, w: 1080, h: 1920 })).toBe(true);
  });

  it("keys: a hold that keeps the camera outside until the next key is found", () => {
    const s = scene(cam("x", keys([0, 560, "hold"], [1, 540, "hold"])), ...still);
    expect(anyOutside(s, b)).toBe(true);
  });

  it("keys: the clamped value after the last key is found", () => {
    const s = scene(cam("x", keys([0, 540, "linear"], [1, 545, "linear"])), ...still);
    const v = (cameraViews(s, W, H, SET) ?? []).filter((x) => outside(b, x).length);
    expect(v.length).toBeGreaterThan(0);
    expect(Math.max(...v.map((x) => x.t))).toBe(1);
  });

  it("mixed tracks: a violation that exists only inside an interval (x stepped by samples, height growing by keys)", () => {
    // x is 540 for the first sample, then 560; height grows linearly 1800 → 1920 over 0..1 s. At t = 1/30 + ε the
    // view is 560 ± 506.3 (inside 1080 wide bounds); at t = 1 it is 560 ± 540 → right side 1100: outside.
    const s = scene(
      cam("x", samples([540, 560])),
      cam("y", keys([0, 960, "hold"])),
      cam("height", keys([0, 1800, "linear"], [1, 1920, "linear"])),
    );
    const out = (cameraViews(s, W, H, SET) ?? []).filter((x) => outside(b, x).length);
    expect(out.map((x) => x.t)).toContain(1);
  });

  it("an undefined camera (missing track, keys out of order) has no views to check", () => {
    expect(cameraViews(scene(...still), W, H, SET)).toBeUndefined();
    expect(
      cameraViews(scene(cam("x", keys([1, 540, "linear"], [0, 540, "linear"])), ...still), W, H, SET),
    ).toBeUndefined();
  });
});

describe("enclose: the smallest enlargement that contains every view, with no rounding", () => {
  it("contains every view, with the near sides exactly at the views' extremes and the far sides within two steps", () => {
    const s = scene(
      cam("x", samples([540.1, 571.3, 602.7])),
      cam("y", samples([960.3, 971.9, 940.05])),
      cam("height", samples([1777.7, 1888.8, 1999.9])),
    );
    const views = cameraViews(s, W, H, SET) ?? [];
    const h = hull(views);
    const b = enclose({ x: h.x + 1, y: h.y + 1, w: 1, h: 1 }, views);
    expect(views.some((v) => outside(b, v).length)).toBe(false);
    expect(b.x).toBe(h.x);
    expect(b.y).toBe(h.y);
    // the far sides reach the views' extremes; float addition may land one step past them, never more than two
    expect(b.x + b.w).toBeGreaterThanOrEqual(h.r);
    expect(b.y + b.h).toBeGreaterThanOrEqual(h.b);
    expect(b.x + b.w - h.r).toBeLessThanOrEqual(2 * ulp(h.r));
    expect(b.y + b.h - h.b).toBeLessThanOrEqual(2 * ulp(h.b));
  });

  it("leaves bounds that already contain every view unchanged", () => {
    const s = scene(cam("x", samples([540])), cam("y", samples([960])), cam("height", samples([1000])));
    const b = { x: -100, y: -100, w: 5000, h: 5000 };
    expect(enclose(b, cameraViews(s, W, H, SET) ?? [])).toBe(b);
  });
});

describe("the views the rounding makes inside an interval (decision B: every instant)", () => {
  // x 540 → 545.4545 and height 1920 → 1939.2 over 1 s, both linear. The exact left edge x − h·W/H/2 is affine
  // and never below 0. The drawn scale is 1 until H/h < 0.995 (t ≈ 0.503), then 0.99: the left edge jumps from
  // ≈ 2.7 to ≈ −2.7 there, and climbs back to −0.0045 at t = 1. Its minimum is inside the interval.
  const s = scene(
    cam("x", keys([0, 540, "linear"], [1, 545.4545, "linear"])),
    cam("y", keys([0, 960, "hold"])),
    cam("height", keys([0, 1920, "linear"], [1, 1939.2, "linear"])),
  );
  const views = cameraViews(s, W, H, SET) ?? [];

  it("finds the minimum inside the interval, at a real instant the renderer draws so", () => {
    const low = views.reduce((a, v) => (v.x0 < a.x0 ? v : a));
    expect(low.t).toBeGreaterThan(0.5);
    expect(low.t).toBeLessThan(0.51);
    expect(low.x0).toBeLessThan(-2.7);
    // the same numbers through the renderer's evaluator at that instant
    const at = (c: string): number =>
      evaluate(s.tracks.find((t) => t.channel === c) as Track, low.t) as number;
    expect(viewOf(drawn(SET, at("x"), at("y"), at("height"), W, H), W, H, low.t)).toEqual(low);
  });

  it("bounds around the interval's ends only are refused; enclose over every view passes, one step less fails", () => {
    const ends = views.filter((v) => v.t === 0 || v.t === 1);
    const byEnds = enclose({ x: 0, y: 0, w: 1, h: 1 }, ends);
    expect(views.some((v) => outside(byEnds, v).length)).toBe(true);
    const b = enclose({ x: 0, y: 0, w: 1, h: 1 }, views);
    expect(views.some((v) => outside(b, v).length)).toBe(false);
    expect(views.some((v) => outside({ ...b, x: nextUp(b.x) }, v).length)).toBe(true);
  });

  it("checks both sides of every change, found to adjacent floats", () => {
    const ts = views.map((v) => v.t).sort((a, b) => a - b);
    const pairs = ts.slice(1).filter((t, i) => t === nextUp(ts[i] as number));
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(cameraViews(s, W, H, SET))).toBe(JSON.stringify(views));
  });
});
