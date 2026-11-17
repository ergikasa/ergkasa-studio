/**
 * K4 (i, ii): fixtures B are drawn from their packages. Every frame renders without error; the drawing of every
 * node visible at that instant and of every person is in the frame's SVG (scenes in a transition included), and
 * every node draws something on some frame (kinetic type draws nothing before its time); prisoner-cell carries
 * captions exactly while a phrase is spoken. (iii) is the contact sheet for the PO: test/package/contact-sheet.ts.
 */
import { describe, expect, it } from "vitest";
import { actorSvg, nodeSvg } from "../../src/package/draw.js";
import { At, type AssetNode } from "../../src/package/scene.js";
import { rasterize } from "../../src/raster.js";
import { fixtureB, renderer } from "./helpers.js";

const CAPTIONS = 'fill="url(#vig)"/><g opacity="';

describe.each([
  ["prisoner-cell", 240],
  ["office-clock", 150],
] as const)("K4 %s", (name, frames) => {
  const r = renderer(fixtureB(name));
  const lib = (r as unknown as { lib: Parameters<typeof nodeSvg>[0] }).lib;

  it(`renders all ${frames} frames, each with every visible node and person`, () => {
    expect(r.frames).toBe(frames);
    let drawn = 0;
    let hidden = 0;
    const seen = new Map<string, boolean>();
    for (let k = 0; k < r.frames; k++) {
      const svg = r.svg(k) as string;
      const { t, cur, prev } = r.at(k);
      for (const scene of prev ? [cur, prev.scene] : [cur]) {
        const at = new At(scene, t);
        for (const l of [...scene.layers, ...(scene.screen ?? [])])
          for (const n of l.nodes.filter((x): x is AssetNode => x.kind === "asset")) {
            const part = nodeSvg(lib, at, n);
            if (!at.visible(n.id)) {
              expect(part).toBe("");
              hidden++;
              continue;
            }
            if (!svg.includes(part)) expect.fail(`${name} frame ${k}: ${scene.id}/${n.id} is not drawn`);
            seen.set(`${scene.id}/${n.id}`, (seen.get(`${scene.id}/${n.id}`) ?? false) || part !== "");
            drawn++;
          }
        for (const a of scene.actors)
          if (!svg.includes(actorSvg(lib, at, a))) expect.fail(`${name} frame ${k}: ${a.id} is not drawn`);
      }
    }
    expect(drawn).toBeGreaterThan(frames);
    expect([...seen].filter(([, v]) => !v)).toEqual([]);
    if (name === "prisoner-cell") expect(hidden).toBeGreaterThan(0); // the chair goes at 6 s
  });

  it("captions only while a phrase is spoken", () => {
    const phrases = r.pkg.overlays.flatMap((o) => (o.kind === "captions" ? o.phrases : []));
    let on = 0;
    for (let k = 0; k < r.frames; k++) {
      const t = k / r.fps;
      const speaking = phrases.some((p) => t >= p.in && t < p.out);
      expect((r.svg(k) as string).includes(CAPTIONS), `frame ${k}`).toBe(speaking);
      if (speaking) on++;
    }
    // prisoner-cell: the phrase is spoken from 5.35 s to 7.8 s, frames 161..233
    expect(on).toBe(name === "prisoner-cell" ? 73 : 0);
  });

  it("frames rasterise (a sample; all frames are hashed by golden-package.ts)", () => {
    for (const k of [0, Math.floor(frames / 2), frames - 1])
      expect(rasterize(r.svg(k) as string).length).toBe(1080 * 1920 * 4);
  });
});
