/**
 * V2 (E1.4): every view a scene's camera takes, checked against bounds without tolerance. Boundary tests for
 * samples, keys (linear, hold, clamped ends), mixed tracks, touching and one-step-outside bounds.
 */
import { describe, expect, it } from "vitest";
import { cameraViews, enclose, outside, viewRect, type RenderPackage } from "../src/index.js";

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
const hull = (vs: ReturnType<typeof viewRect>[]) => ({
  x: Math.min(...vs.map((v) => v.x0)),
  y: Math.min(...vs.map((v) => v.y0)),
  r: Math.max(...vs.map((v) => v.x1)),
  b: Math.max(...vs.map((v) => v.y1)),
});
const anyOutside = (s: Scene, bounds: Scene["bounds"]): boolean =>
  (cameraViews(s, W, H) ?? []).some((v) => outside(bounds, v).length > 0);

describe("the view (flat set, editorial at x = W/2, parallax at the actors' plane)", () => {
  it("is [x − h·W/H/2, x + h·W/H/2] × [y − h/2, y + h/2]", () => {
    expect(viewRect(0, 540, 960, 1920, W, H)).toEqual({ t: 0, x0: 0, x1: 1080, y0: 0, y1: 1920 });
    expect(viewRect(0, 1000, -700, 1500, W, H)).toEqual({
      t: 0,
      x0: 578.125,
      x1: 1421.875,
      y0: -1450,
      y1: 50,
    });
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

  it("keys: linear between two inside keys stays inside (affine, the extremes are the keys)", () => {
    const s = scene(
      cam("x", keys([0, 540, "linear"], [1, 540, "linear"])),
      cam("y", keys([0, 900, "linear"], [1, 960, "linear"])),
      cam("height", keys([0, 1800, "linear"], [1, 1920, "linear"])),
    );
    expect(anyOutside(s, { x: 0, y: 0, w: 1080, h: 1920 })).toBe(false);
  });

  it("keys: a hold that keeps the camera outside until the next key is found", () => {
    const s = scene(cam("x", keys([0, 560, "hold"], [1, 540, "hold"])), ...still);
    expect(anyOutside(s, b)).toBe(true);
  });

  it("keys: the clamped value after the last key is found", () => {
    const s = scene(cam("x", keys([0, 540, "linear"], [1, 545, "linear"])), ...still);
    const v = (cameraViews(s, W, H) ?? []).filter((x) => outside(b, x).length);
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
    const out = (cameraViews(s, W, H) ?? []).filter((x) => outside(b, x).length);
    expect(out.map((x) => x.t)).toContain(1);
  });

  it("an undefined camera (missing track, keys out of order) has no views to check", () => {
    expect(cameraViews(scene(...still), W, H)).toBeUndefined();
    expect(
      cameraViews(scene(cam("x", keys([1, 540, "linear"], [0, 540, "linear"])), ...still), W, H),
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
    const views = cameraViews(s, W, H) ?? [];
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
    expect(enclose(b, cameraViews(s, W, H) ?? [])).toBe(b);
  });
});
