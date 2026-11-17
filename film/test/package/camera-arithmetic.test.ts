/**
 * E1.4 final audit F4 (decision B): the renderer draws its views with the arithmetic the gate and the stager check
 * bounds with (contracts camera-view.ts), and that arithmetic writes exactly what the engine wrote before:
 *   - set and editorial: the same text as v2frame.ts setView / editorialView (the default pipeline's);
 *   - W0: w0/camera.ts project and svgTransform are the shared ones, at REF and GAMMA, which the capabilities
 *     publish;
 *   - every flat frame of the five films carries the view transform `drawn` gives at that frame's camera.
 */
import {
  builtinOf,
  drawn,
  numberAt,
  sceneLens,
  type AssetManifest,
  project as shared,
  projected,
  transformAttr,
  type RenderPackage,
} from "@erkasa/contracts";
import { serialise, stageFilm } from "@erkasa/stager";
import { describe, expect, it } from "vitest";
import { renderCapabilities } from "../../src/capabilities.js";
import { BENCH } from "../../src/golden.js";
import { openPackage } from "../../src/package/render.js";
import { H, W } from "../../src/style.js";
import { editorialView, setView } from "../../src/v2frame.js";
import { GAMMA, project, REF, svgTransform } from "../../src/w0/camera.js";
import { staged, type Film } from "./helpers.js";

/** A deterministic spread of cameras, with values on and near the rounding thresholds. */
const cams = (): Array<{ x: number; y: number; h: number }> => {
  const out: Array<{ x: number; y: number; h: number }> = [];
  let seed = 7;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++)
    out.push({ x: -500 + rnd() * 4000, y: -500 + rnd() * 3000, h: 400 + rnd() * 3000 });
  for (const v of [540.005, 540.015, 0.005, -0.005, 960.125, 1929.6482412060302])
    out.push({ x: v, y: v, h: 1920 }, { x: 540, y: 960, h: v > 100 ? v : 1920 });
  return out;
};
const attr = (svg: string): string => /^<g transform="([^"]+)">/.exec(svg)?.[1] ?? "";

describe("F4: one camera arithmetic for the renderer, the gate and the stager", () => {
  it("a set view: the same text as setView", () => {
    for (const c of cams())
      expect(transformAttr(drawn({ kind: "set" }, c.x, c.y, c.h, W, H))).toBe(
        attr(setView({ cx: c.x, cy: c.y, height: c.h }, "")),
      );
  });
  it("an editorial view: the same text as editorialView at z = H/h, dy = (960 − y)·z", () => {
    for (const c of cams()) {
      const z = H / c.h;
      expect(transformAttr(drawn({ kind: "editorial" }, c.x, c.y, c.h, W, H))).toBe(
        attr(editorialView(z, (960 - c.y) * z, "")),
      );
    }
  });
  it("W0: project and svgTransform are the shared functions at REF and GAMMA, published in the capabilities", () => {
    const par = renderCapabilities().projections["parallax"]?.camera.parallax;
    expect(par).toEqual({ reference: REF, gamma: GAMMA, plane: "w0.mid" });
    for (const c of cams())
      for (const dz of [30000, 5200, 2600, 520, 0, -650]) {
        const cam = { cx: c.x, cy: c.y, height: c.h };
        const p = project(cam, dz);
        expect(p).toEqual(shared(cam, dz, REF, GAMMA, H));
        expect(svgTransform(p)).toBe(transformAttr(projected(p, W, H)));
        if (dz === 0)
          expect(svgTransform(p)).toBe(
            transformAttr(
              drawn({ kind: "parallax", reference: REF, gamma: GAMMA, plane: 0 }, c.x, c.y, c.h, W, H),
            ),
          );
      }
  });
  it.each(BENCH.map((f) => [f]))(
    "%s: every frame's view transform (both scenes in a transition) is the one the gate checks",
    (f) => {
      const w = serialise(stageFilm(f as Film));
      const i = staged(f as Film);
      const o = openPackage({ package: i.text, root: i.root });
      if (!o.ok) throw new Error(JSON.stringify(o.errors.slice(0, 2)));
      const r = o.renderer;
      const caps = renderCapabilities();
      const of = builtinOf(JSON.parse(w.manifest) as AssetManifest);
      const view = (s: RenderPackage["scenes"][number], t: number): string => {
        const rule = caps.projections[s.camera.projection]?.camera;
        const lens = rule ? sceneLens(s, of, rule) : undefined;
        if (!lens) throw new Error(s.id);
        const at = (c: string): number => numberAt(s, "camera", undefined, c, t);
        return `<g transform="${transformAttr(drawn(lens, at("x"), at("y"), at("height"), W, H))}">`;
      };
      let n = 0;
      for (let k = 0; k < r.frames; k++) {
        const { t, cur, prev } = r.at(k);
        const svg = r.svg(k) ?? "";
        expect(svg).toContain(view(cur, t));
        if (prev) expect(svg).toContain(view(prev.scene, t));
        n++;
      }
      expect(n).toBe(r.frames);
    },
    600_000,
  );
});
