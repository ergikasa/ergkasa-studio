/**
 * Gate PASS ⟹ the renderer executes (E1.4, capabilities v2): the eight existing packages and the allowed edge
 * packages pass the gate with no finding and render every frame without error (parallax: every cut's first frame
 * and the frames of every transition). Their frames are the approved ones (K1, K2/K3, K7: golden-package.ts).
 */
import { describe, expect, it } from "vitest";
import { validate, type RenderCapabilities } from "@erkasa/gate";
import { capabilities } from "../../src/capabilities.js";
import { openPackage } from "../../src/package/render.js";
import { BENCH } from "../../src/golden.js";
import { mixed } from "../../../gate/test/executable-cases.js";
import { write } from "../../../gate/test/helpers.js";
import { fixtureB, staged, type Film } from "./helpers.js";

const caps = capabilities().render as RenderCapabilities;

async function renders(input: { root: string; text: string }): Promise<number> {
  const o = openPackage({ package: input.text, root: input.root });
  if (!o.ok) throw new Error(JSON.stringify(o.errors.slice(0, 3)));
  const r = o.renderer;
  const starts = new Set(r.pkg.edit.map((c) => Math.ceil(c.start * r.fps - 1e-9)));
  let n = 0;
  for (let k = 0; k < r.frames; k++) {
    const { cur, prev } = r.at(k);
    if (cur.camera.projection === "flat" && prev?.scene.camera.projection !== "parallax") r.svg(k);
    else if (starts.has(k) || prev) await r.pixels(k);
    else continue;
    n++;
  }
  return n;
}

const PACKAGES: Array<[string, () => { root: string; text: string }]> = [
  ...[...BENCH, "w0-office"].map((f): [string, () => { root: string; text: string }] => [
    f,
    () => staged(f as Film),
  ]),
  ["prisoner-cell", () => fixtureB("prisoner-cell")],
  ["office-clock", () => fixtureB("office-clock")],
];

describe("the eight packages (P1, P3)", () => {
  it.each(PACKAGES)(
    "%s passes the gate with no finding and renders",
    async (_, input) => {
      const i = input();
      const g = validate({ package: i.text, root: i.root, capabilities: caps });
      expect([...g.errors, ...g.warnings]).toEqual([]);
      expect(await renders(i)).toBeGreaterThan(0);
    },
    900_000,
  );
});

describe("allowed edge packages (P2)", () => {
  it.each(["flat-parallax", "parallax-flat"] as const)(
    "a cut between a flat and a W0 scene (%s): passes and renders",
    async (order) => {
      const m = mixed(order);
      const second = m.pkg.edit[1];
      if (second) second.enter = { kind: "cut", duration: 0 };
      const w = write(m.pkg, m.manifest, { root: m.root });
      const g = validate({ package: w.text, root: w.root, capabilities: caps });
      expect(g.errors).toEqual([]);
      expect(await renders(w)).toBeGreaterThan(0);
    },
    900_000,
  );
});
