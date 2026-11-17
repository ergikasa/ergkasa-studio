/**
 * Unit tests of src/evaluate.ts, the one reading of the contract's evaluation rules. The staged packages only
 * use single keys and samples, so the key interpolation paths are exercised here directly.
 */
import { describe, expect, it } from "vitest";
import type { RenderPackage, Track } from "../src/index.js";
import {
  evaluate,
  frameTime,
  numberAt,
  phraseAt,
  sampleIndex,
  trackOf,
  visibleAt,
  wordCurrent,
  wordReached,
} from "../src/evaluate.js";

type Scene = RenderPackage["scenes"][number];
const node = { kind: "node", id: "n" } as const;
const keys = (ks: Array<[number, number | string, string]>): Track =>
  ({ kind: "keys", target: node, channel: "x", keys: ks.map(([t, v, ease]) => ({ t, v, ease })) }) as Track;
const samples = (start: number, rate: number, values: number[]): Extract<Track, { kind: "samples" }> => ({
  kind: "samples",
  target: node,
  channel: "x",
  start,
  rate,
  values,
});

describe("keys", () => {
  const tr = keys([
    [1, 10, "linear"],
    [3, 30, "linear"],
    [5, 0, "hold"],
  ]);
  it("hold the first value before the first key and the last after the last", () => {
    expect(evaluate(tr, 0)).toBe(10);
    expect(evaluate(tr, 1)).toBe(10);
    expect(evaluate(tr, 5)).toBe(0);
    expect(evaluate(tr, 99)).toBe(0);
  });
  it("travel linearly with a linear key, exactly at the key times", () => {
    expect(evaluate(tr, 2)).toBe(20);
    expect(evaluate(tr, 3)).toBe(30);
  });
  it("keep the previous value until a hold key", () => {
    expect(evaluate(tr, 4.999)).toBe(30);
  });
  it("a single key is a constant", () => {
    expect(evaluate(keys([[2, 7, "linear"]]), 0)).toBe(7);
    expect(evaluate(keys([[2, 7, "linear"]]), 100)).toBe(7);
  });
  it("refuse eases that have no numeric definition yet, and colours that would be interpolated", () => {
    expect(() =>
      evaluate(
        keys([
          [0, 0, "linear"],
          [1, 1, "easeInOut"],
        ]),
        0.5,
      ),
    ).toThrow(/no numeric definition/);
    expect(() =>
      evaluate(
        keys([
          [0, "#000000", "linear"],
          [1, "#FFFFFF", "linear"],
        ]),
        0.5,
      ),
    ).toThrow(/hold only/);
    expect(
      evaluate(
        keys([
          [0, "#000000", "linear"],
          [1, "#FFFFFF", "hold"],
        ]),
        0.5,
      ),
    ).toBe("#000000");
  });
});

describe("samples", () => {
  it("read values[floor((t - start) * rate + 1e-6)], clamped", () => {
    const tr = samples(1, 30, [10, 11, 12, 13]);
    expect(evaluate(tr, 0)).toBe(10);
    expect(evaluate(tr, 1)).toBe(10);
    expect(evaluate(tr, 1 + 1 / 30)).toBe(11);
    expect(evaluate(tr, 1 + 1.5 / 30)).toBe(11);
    expect(evaluate(tr, 10)).toBe(13);
  });
  it("every frame of a 30 fps film reads its own sample, over 10 minutes, from any starting frame", () => {
    for (const first of [0, 1, 7, 299, 1351]) {
      const n = 18_000;
      const tr = samples(
        frameTime(first, 30),
        30,
        Array.from({ length: n }, (_, i) => i),
      );
      for (let k = 0; k < n; k++)
        if (sampleIndex(tr, frameTime(first + k, 30)) !== k) expect.fail(`start ${first}: frame ${k}`);
    }
  });
});

describe("scene lookups", () => {
  const scene = {
    id: "s",
    tracks: [keys([[0, 5, "linear"]])],
    events: [
      { t: 2, node: "n", visible: true, fx: "none", duration: 0 },
      { t: 1, node: "n", visible: false, fx: "none", duration: 0 },
      { t: 3, node: "m", state: "open", fx: "none", duration: 0 },
    ],
  } as unknown as Scene;
  it("find exactly one track and read numbers through it", () => {
    expect(numberAt(scene, "node", "n", "x", 0)).toBe(5);
    expect(() => trackOf(scene, "node", "n", "y")).toThrow(/0 tracks/);
    const twice = { ...scene, tracks: [...scene.tracks, ...scene.tracks] } as Scene;
    expect(() => trackOf(twice, "node", "n", "x")).toThrow(/2 tracks/);
  });
  it("visibility follows the latest event at or before t, whatever the array order", () => {
    expect(visibleAt(scene, "n", 0.5)).toBe(true);
    expect(visibleAt(scene, "n", 1)).toBe(false);
    expect(visibleAt(scene, "n", 1.9)).toBe(false);
    expect(visibleAt(scene, "n", 2)).toBe(true);
    expect(visibleAt(scene, "m", 4)).toBe(true);
  });
});

describe("captions", () => {
  const overlay = {
    kind: "captions",
    phrases: [
      {
        in: 1,
        out: 2,
        words: [
          { text: "a", t: 1, end: 1.5 },
          { text: "b", t: 1.5, end: 2 },
        ],
      },
    ],
  } as unknown as Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
  it("a phrase is on screen for in <= t < out", () => {
    expect(phraseAt(overlay, 0.99)).toBeUndefined();
    expect(phraseAt(overlay, 1)).toBeDefined();
    expect(phraseAt(overlay, 2)).toBeUndefined();
  });
  it("a word is reached at t and current until end", () => {
    const [a, b] = overlay.phrases[0]?.words ?? [];
    if (!a || !b) throw new Error("words");
    expect([wordReached(a, 1), wordCurrent(a, 1), wordCurrent(a, 1.5), wordReached(b, 1.49)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
