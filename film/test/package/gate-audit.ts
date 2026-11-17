/**
 * E1.4 gate audit (PO request, 2026-11-17): packages the gate accepts with this engine's capabilities, rendered
 * frame by frame (parallax: every cut's first frame and every 3rd transition frame). Does every accepted package
 * draw? Findings in docs/reports/e1-4-engine-reads-package.md §5.2. Not a test: it documents today's gaps.
 *
 *   node --expose-gc --import tsx test/package/gate-audit.ts [case index]
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- an audit script over known package shapes */
import { validate, type RenderCapabilities } from "@erkasa/gate";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { capabilities } from "../../src/capabilities.js";
import { openPackage } from "../../src/package/render.js";
import { base, film, write } from "../../../gate/test/helpers.js";

const caps = capabilities().render as RenderCapabilities;
type B = { pkg: RenderPackage; manifest: AssetManifest; root?: string };
type Scene = RenderPackage["scenes"][number];
const chairScene = (b: B): Scene =>
  b.pkg.scenes.find((x) => x.layers.some((l) => l.nodes.some((n) => n.id === "chairfile")))!;
const node = (s: Scene, id: string) =>
  [...s.layers, ...(s.screen ?? [])].flatMap((l) => l.nodes).find((n) => n.id === id)!;
const sceneOf = (b: B, pred: (s: Scene) => boolean) => b.pkg.scenes.find(pred)!;
const w0 = (): B => film("w0-office");
const CASES: Array<[string, () => B]> = [
  [
    "element state (id exists? 'seat' does not)",
    () => {
      const b = base();
      (b.manifest.assets.find((a) => a.id === "prop_chairfile") as { states: unknown[] }).states = [
        { name: "default", element: "seat" },
      ];
      return b;
    },
  ],
  [
    "non-W0 node in parallax",
    () => {
      const b = base();
      chairScene(b).camera.projection = "parallax";
      return b;
    },
  ],
  [
    "flat -> parallax dissolve",
    () => {
      const b = base();
      b.pkg.edit[1]!.enter = { kind: "dissolve", duration: 0.45 };
      sceneOf(b, (s) => s.id === b.pkg.edit[1]!.scene).camera.projection = "parallax";
      return b;
    },
  ],
  [
    "whip in parallax (W0)",
    () => {
      const b = w0();
      b.pkg.edit.find((c) => c.enter.kind === "dissolve")!.enter = { kind: "whip", duration: 0.32 };
      return b;
    },
  ],
  [
    "parallax -> flat (W0 scene 2 flat)",
    () => {
      const b = w0();
      b.pkg.scenes[1]!.camera.projection = "flat";
      return b;
    },
  ],
  [
    "W0 builtin (w0.sky) in a flat scene",
    () => {
      const b = w0();
      b.pkg.scenes[0]!.camera.projection = "flat";
      return b;
    },
  ],
  [
    "parallax scene without W0's mid layer",
    () => {
      const b = w0();
      const s = b.pkg.scenes[0]!;
      const gone = new Set(s.layers.filter((l) => l.id === "mid").flatMap((l) => l.nodes.map((n) => n.id)));
      s.layers = s.layers.filter((l) => l.id !== "mid");
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "node" && gone.has(t.target.id)));
      s.events = s.events.filter((e) => !gone.has((e as { node?: string }).node ?? ""));
      return b;
    },
  ],
  [
    "channel parameter without a track (set_back param.t)",
    () => {
      const b = base();
      const s = chairScene(b);
      s.tracks = s.tracks.filter(
        (t) => !(t.target.kind === "node" && t.target.id === "set_back" && t.channel === "param.t"),
      );
      return b;
    },
  ],
  [
    "camera without its height track",
    () => {
      const b = base();
      const s = chairScene(b);
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "camera" && t.channel === "height"));
      return b;
    },
  ],
  [
    "pivot that the asset does not have",
    () => {
      const b = base();
      (node(chairScene(b), "chairfile") as { pivot: string | null }).pivot = "hinge";
      return b;
    },
  ],
  [
    "node in a state the asset does not have",
    () => {
      const b = base();
      (node(chairScene(b), "chairfile") as { state: string }).state = "broken";
      return b;
    },
  ],
  [
    "edit names a missing scene",
    () => {
      const b = base();
      b.pkg.edit[0]!.scene = "nope";
      return b;
    },
  ],
  [
    "captions font that is not a font",
    () => {
      const b = base();
      b.pkg.overlays.push({
        kind: "captions",
        id: "cap",
        at: { x: 0.5, y: 0.85 },
        style: { font: "prop_chairfile@1", size: 50, color: "#FFFFFF", align: "center" },
        phrases: [{ in: 0, out: 1, words: [{ text: "hi", t: 0, end: 0.5 }] }],
      } as unknown as RenderPackage["overlays"][number]);
      return b;
    },
  ],
  [
    "rig whose source is a file",
    () => {
      const b = base();
      const r = b.manifest.assets.find((a) => a.kind === "rig")! as { source: unknown };
      r.source = (b.manifest.assets.find((a) => a.id === "prop_chairfile") as { source: unknown }).source;
      return b;
    },
  ],
  [
    "captions aligned left (style.align)",
    () => {
      const b = film("w0-office");
      for (const o of b.pkg.overlays) if (o.kind === "captions") o.style.align = "left";
      return b;
    },
  ],
  [
    "type node without its lines parameter",
    () => {
      const b = base();
      const s = b.pkg.scenes.find((x) => (x.screen ?? []).some((l) => l.id === "type"))!;
      delete (node(s, "type") as { params?: Record<string, unknown> }).params!["lines"];
      return b;
    },
  ],
];
const only = process.argv[2] ? [CASES[Number(process.argv[2])]!] : CASES;
for (const [name, make] of only) {
  let b: B;
  try {
    b = make();
  } catch (e) {
    console.info(`${name}: could not build (${(e as Error).message.slice(0, 80)})`);
    continue;
  }
  const w = write(b.pkg, b.manifest, b.root ? { root: b.root } : {});
  const g = validate({ package: w.text, root: w.root, capabilities: caps });
  let out = "not rendered (refused)";
  if (g.ok) {
    const o = openPackage({ package: w.text, root: w.root });
    if (!o.ok) out = "openPackage refused?!";
    else {
      const r = o.renderer;
      out = `rendered all ${r.frames}`;
      try {
        for (let k = 0; k < r.frames; k++) {
          const { cur, prev } = r.at(k);
          const parallax =
            cur.camera.projection === "parallax" || prev?.scene.camera.projection === "parallax";
          const first = r.pkg.edit.some(
            (c) => Math.round(c.start * r.fps) === k || Math.ceil(c.start * r.fps) === k,
          );
          if (parallax) {
            if (first || (prev && k % 3 === 0)) {
              await r.pixels(k);
              (globalThis as { gc?: () => void }).gc?.();
            }
          } else r.svg(k);
        }
      } catch (e) {
        out = `RENDER ERROR: ${(e as Error).message.slice(0, 150)}`;
      }
    }
  }
  console.info(
    `${name} | gate ok=${g.ok} ${g.errors
      .slice(0, 3)
      .map((e) => `${e.code} ${e.file}${e.path}`)
      .join("; ")} | ${out}`,
  );
}
