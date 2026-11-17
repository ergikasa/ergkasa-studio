/**
 * K1: B1–B5 frame by frame. The renderer draws every frame from the staged package alone; its SVG must equal
 * frameAt's (the plan path, same commit) once kinetic-type ids are normalised, and carry no captions.
 */
import { describe, expect, it } from "vitest";
import { frameAt } from "../../src/compose.js";
import { BENCH } from "../../src/golden.js";
import { normaliseKtIds } from "../../src/golden-ids.js";
import { planPath, renderer, staged } from "./helpers.js";

const EXPECTED: Record<string, number> = {
  "b1-why-we-stay": 1506,
  "b2-same-answers": 1258,
  "b3-every-yes": 1051,
  "b4-one-percent": 1016,
  "b5-planning-fallacy": 1212,
};

describe.each(BENCH)("K1 %s", (name) => {
  it("every frame: the renderer's SVG equals frameAt's, up to kinetic-type ids; no captions", () => {
    const r = renderer(staged(name));
    const plan = planPath(name);
    expect(r.frames).toBe(EXPECTED[name]);
    let same = 0;
    let idsOnly = 0;
    const fails: string[] = [];
    for (let k = 0; k < r.frames; k++) {
      const got = r.svg(k) as string;
      const { i, n } = plan.at(k);
      const want = frameAt(plan.composed, i, n);
      if (got === want) same++;
      else if (normaliseKtIds(got) === normaliseKtIds(want)) idsOnly++;
      else fails.push(`frame ${k} (shot ${i}, local ${n})`);
      // nothing is drawn over the vignette (captions would be): the frame ends with it
      if (!got.endsWith('<rect width="1080" height="1920" fill="url(#vig)"/></svg>'))
        fails.push(`frame ${k}: something after the vignette`);
    }
    expect(fails.slice(0, 10)).toEqual([]);
    expect(same + idsOnly).toBe(EXPECTED[name]);
  }, 600_000);
});
