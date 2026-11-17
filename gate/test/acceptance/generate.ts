/**
 * Gate acceptance fixtures (B): small packages built only from what the current engine publishes in
 * `capabilities().render` and from real files of this repository. Unlike the contract fixtures (A, in
 * contracts/fixtures/), they are meant to be executable by this engine and must pass every gate check.
 *
 *   prisoner-cell   the executable counterpart of the contract's prisoner-cell: the real prison-cell and chair
 *                   SVGs as file assets, a person, a camera move, captions in the engine's caption font.
 *   office-clock    the executable counterpart of office-procedural: the procedural office set, a person, kinetic
 *                   type in a screen layer, then a whip into the clock template, every input as the engine takes it.
 *
 * Builtins are pinned to the engine's own fingerprints, so these fixtures must be regenerated (deliberately) when
 * the engine code they pin changes:   pnpm --filter @erkasa/gate fixtures:acceptance
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { renderCapabilities } from "@erkasa/film";
import { fontFiles } from "../../../stager/src/legacy.js";
import { fontAsset, rig } from "../../../stager/src/manifest.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const DIR = "gate/fixtures/acceptance";
export const NAMES = ["prisoner-cell", "office-clock"] as const;

type Asset = AssetManifest["assets"][number];
type Scene = RenderPackage["scenes"][number];
type Node = Scene["layers"][number]["nodes"][number];

const sha = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");
const caps = renderCapabilities();
const builtin = (name: string) => {
  const b = caps.builtins.find((x) => x.name === name);
  if (!b) throw new Error(`the engine does not publish '${name}'`);
  return b;
};
const src = (name: string) => {
  const b = builtin(name);
  return { kind: "builtin" as const, name, version: b.version, fingerprint: b.fingerprint };
};
const file = (uri: string) => ({ kind: "file" as const, uri, sha256: sha(readFileSync(join(ROOT, uri))) });
const meta = {
  style: { kit: "erkasa_editorial_v2" },
  approval: { status: "approved" as const, note: "Gate acceptance fixture." },
  license: "LicenseRef-Erkasa-Original",
};
/** A file-drawn vector asset with one state. */
const svgAsset = (
  id: string,
  uri: string,
  viewBox: [number, number, number, number],
  size: { w: number; h: number },
  origin: [number, number],
): Asset => ({
  id,
  version: 1,
  kind: "vector",
  format: "svg",
  source: file(uri),
  geometry: { viewBox, size, origin },
  states: [{ name: "default", source: file(uri) }],
  defaultState: "default",
  affordances: [],
  pivots: [],
  provenance: { origin: "generator" },
  ...meta,
});
/** A procedural asset: one builtin per state, its inputs exactly as the engine declares them. */
const procedural = (id: string, states: Array<[string, string]>, size: { w: number; h: number }): Asset => {
  const params = builtin((states[0] as [string, string])[1]).parameters ?? [];
  return {
    id,
    version: 1,
    kind: "vector",
    format: "svg",
    source: src((states[0] as [string, string])[1]),
    geometry: { viewBox: [0, 0, size.w, size.h], size, origin: [0, 0] },
    states: states.map(([name, b]) => ({ name, source: src(b) })),
    defaultState: (states[0] as [string, string])[0],
    affordances: [],
    pivots: [],
    ...(params.length ? { parameters: structuredClone(params) } : {}),
    provenance: { origin: "builtin" },
    ...meta,
  };
};
const node = (
  id: string,
  asset: string,
  state: string,
  x = 0,
  y = 0,
  params?: Record<string, unknown>,
): Node =>
  ({
    kind: "asset",
    id,
    asset,
    x,
    y,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flip: false,
    state,
    pivot: null,
    ...(params ? { params } : {}),
  }) as Node;
const keys = (
  target: Scene["tracks"][number]["target"],
  channel: string,
  ks: Array<[number, number]>,
): Scene["tracks"][number] => ({
  kind: "keys",
  target,
  channel,
  keys: ks.map(([t, v]) => ({ t, v, ease: "linear" })),
});
const appearance = {
  coat: "#C8742F",
  coatDark: "#8F4E1C",
  pants: "#2E3440",
  skin: "#E8B48F",
  skinShade: "#C98F6B",
  hair: "#2B2522",
};
const FPS = 30;
const walk = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => Math.round(22 * Math.sin((2 * Math.PI * 1.6 * i) / FPS) * 1000) / 1000);
const pkgBase = (id: string, duration: number) => ({
  schema: "erkasa.render/1" as const,
  id,
  producer: { name: "gate-acceptance-fixture", version: "1" },
  output: { width: 1080, height: 1920, fps: FPS, duration },
  assetManifest: { uri: `${DIR}/${id.split(".")[0]}.assets.json`, sha256: "" },
});

function prisonerCell(): { manifest: AssetManifest; pkg: RenderPackage } {
  const font = fontAsset("font_montserrat_extrabold", fontFiles()[2] as string, 800);
  const manifest: AssetManifest = {
    schema: "erkasa.assets/1",
    id: "prisoner-cell.acceptance.1",
    assets: [
      svgAsset(
        "set_prison_cell",
        "assets/backgrounds/bg_prison_cell_01/asset.svg",
        [0, 0, 2560, 1920],
        { w: 2560, h: 1920 },
        [1280, 1920],
      ),
      svgAsset(
        "prop_chair",
        "assets/objects/obj_chair/asset.svg",
        [0, 0, 32, 32],
        { w: 96, h: 96 },
        [16, 32],
      ),
      rig("man"),
      font,
    ],
  };
  const man = { kind: "actor", id: "man" } as const;
  const pkg = {
    ...pkgBase("prisoner-cell.acceptance", 8),
    scenes: [
      {
        id: "cell",
        bounds: { x: 0, y: -1920, w: 2560, h: 1920 },
        background: "#1B1F2A",
        camera: { projection: "flat", referenceDistance: 1920, dolly: 0, aperture: 0 },
        layers: [
          {
            id: "room",
            depth: 0,
            blur: 0,
            lit: false,
            nodes: [node("cell_set", "set_prison_cell@1", "default", 1280, 0)],
          },
          {
            id: "floor",
            depth: 0,
            blur: 0,
            lit: false,
            nodes: [node("chair", "prop_chair@1", "default", 760, 0)],
          },
          { id: "actor_man", depth: 0, blur: 0, lit: false, nodes: [] },
        ],
        actors: [
          { id: "man", rig: "rig_cutout_man@1", layer: "actor_man", appearance, shadow: false, rim: false },
        ],
        lights: [],
        tracks: [
          keys({ kind: "camera" }, "x", [
            [0, 1000],
            [8, 1500],
          ]),
          keys({ kind: "camera" }, "y", [[0, -700]]),
          keys({ kind: "camera" }, "height", [[0, 1500]]),
          keys(man, "root.x", [
            [0, 700],
            [1, 700],
            [4, 1650],
          ]),
          keys(man, "root.y", [[0, 0]]),
          keys(man, "root.scale", [[0, 1]]),
          keys(man, "facing", [[0, 1]]),
          keys(man, "turn", [[0, 1]]),
          { kind: "samples", target: man, channel: "bone.thigh", start: 1, rate: FPS, values: walk(91) },
          {
            kind: "samples",
            target: man,
            channel: "bone.thighF",
            start: 1,
            rate: FPS,
            values: walk(91).map((v) => (v === 0 ? 0 : -v)),
          },
        ],
        contacts: [],
        events: [{ t: 6, node: "chair", visible: false, fx: "none", duration: 0 }],
      },
    ],
    edit: [{ scene: "cell", start: 0, end: 8, enter: { kind: "cut", duration: 0 } }],
    overlays: [
      {
        kind: "captions",
        id: "captions",
        style: {
          font: "font_montserrat_extrabold@1",
          size: 58,
          color: "#FBF6EC",
          stroke: { color: "#0C1529", width: 12 },
          align: "center",
        },
        at: { x: 0.5, y: 1640 / 1920 },
        highlight: "#F4A261",
        phrases: [
          {
            in: 5.35,
            out: 7.8,
            words: [
              { text: "The", t: 5.38, end: 5.58 },
              { text: "door", t: 5.58, end: 5.98 },
              { text: "was", t: 5.98, end: 6.18 },
              { text: "open.", t: 6.18, end: 7.05 },
            ],
          },
        ],
      },
    ],
    audio: [],
    mix: { duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1.5 } },
  } as RenderPackage;
  return { manifest, pkg };
}

function officeClock(): { manifest: AssetManifest; pkg: RenderPackage } {
  const manifest: AssetManifest = {
    schema: "erkasa.assets/1",
    id: "office-clock.acceptance.1",
    assets: [
      procedural(
        "set_office",
        [
          ["back", "set.office.back"],
          ["front", "set.office.front"],
        ],
        { w: 2200, h: 2000 },
      ),
      procedural("type_kinetic", [["default", "type.kinetic"]], { w: 1080, h: 1920 }),
      procedural("tpl_clock", [["default", "template.clock"]], { w: 1080, h: 1920 }),
      rig("woman"),
    ],
  };
  const maya = { kind: "actor", id: "maya" } as const;
  const breath = Array.from(
    { length: 90 },
    (_, i) => Math.round((0.5 + 0.5 * Math.sin((i / FPS) * 1.7)) * 1e6) / 1e6,
  );
  const pkg = {
    ...pkgBase("office-clock.acceptance", 5),
    scenes: [
      {
        id: "office_wide",
        bounds: { x: 0, y: 0, w: 2200, h: 2000 },
        background: "#0C1529",
        camera: { projection: "flat", referenceDistance: 1920, dolly: 0, aperture: 0 },
        layers: [
          { id: "back", depth: 0, blur: 0, lit: false, nodes: [node("set_back", "set_office@1", "back")] },
          { id: "actor_maya", depth: 0, blur: 0, lit: false, nodes: [] },
          { id: "front", depth: 0, blur: 0, lit: false, nodes: [node("set_front", "set_office@1", "front")] },
        ],
        screen: [
          {
            id: "type",
            nodes: [
              node("type", "type_kinetic@1", "default", 0, 0, {
                lines: [{ t: "Why do we stay?", weight: "bold" }],
                y: 250,
                at: 0.4,
                out: null,
                dark: false,
              }),
            ],
          },
        ],
        actors: [
          {
            id: "maya",
            rig: "rig_cutout_woman@1",
            layer: "actor_maya",
            appearance,
            shadow: false,
            rim: false,
          },
        ],
        lights: [],
        tracks: [
          keys({ kind: "camera" }, "x", [[0, 1100]]),
          keys({ kind: "camera" }, "y", [[0, 1000]]),
          keys({ kind: "camera" }, "height", [[0, 2000]]),
          ...["set_back", "set_front"].flatMap((n) => [
            keys({ kind: "node", id: n }, "param.light", [
              [0, 1],
              [1.2, 1],
              [3, 3],
            ]),
            keys({ kind: "node", id: n }, "param.t", [
              [0, 0],
              [3, 3],
            ]),
            keys({ kind: "node", id: n }, "param.door", [[0, 0]]),
          ]),
          keys({ kind: "node", id: "type" }, "param.t", [
            [0, 0],
            [3, 3],
          ]),
          keys(maya, "root.x", [[0, 1300]]),
          keys(maya, "root.y", [[0, 1420]]),
          keys(maya, "root.scale", [[0, 1]]),
          keys(maya, "facing", [[0, -1]]),
          keys(maya, "turn", [[0, 1]]),
          { kind: "samples", target: maya, channel: "channel.breath", start: 0, rate: FPS, values: breath },
        ],
        contacts: [],
        events: [],
      },
      {
        id: "clock",
        bounds: { x: 0, y: 0, w: 1080, h: 1920 },
        background: "#F3EBDD",
        camera: { projection: "flat", referenceDistance: 1920, dolly: 0, aperture: 0 },
        layers: [
          {
            id: "template",
            depth: 0,
            blur: 0,
            lit: false,
            nodes: [
              node("template", "tpl_clock@1", "default", 0, 0, {
                params: { time: "6:40" },
                anchors: {},
                dur: 2,
              }),
            ],
          },
        ],
        actors: [],
        lights: [],
        tracks: [
          keys({ kind: "camera" }, "x", [[3, 540]]),
          keys({ kind: "camera" }, "y", [[3, 960]]),
          keys({ kind: "camera" }, "height", [[3, 1920]]),
          keys({ kind: "node", id: "template" }, "param.t", [
            [3, 0],
            [5, 2],
          ]),
        ],
        contacts: [],
        events: [],
      },
    ],
    edit: [
      { scene: "office_wide", start: 0, end: 3, enter: { kind: "cut", duration: 0 } },
      { scene: "clock", start: 3, end: 5, enter: { kind: "whip", duration: 0.32 } },
    ],
    overlays: [],
    audio: [],
    mix: { duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1.5 } },
  } as RenderPackage;
  return { manifest, pkg };
}

/** The fixtures as they must be on disk: formatted, the package pinned to the formatted manifest's bytes. */
export function generate(): Array<{
  name: string;
  manifestPath: string;
  packagePath: string;
  manifest: string;
  pkg: string;
}> {
  const prettier = join(ROOT, "node_modules/.bin/prettier");
  const fmt = (text: string, path: string): string =>
    execFileSync(prettier, ["--stdin-filepath", path], { input: text, encoding: "utf8", cwd: ROOT });
  return NAMES.map((name) => {
    const { manifest, pkg } = name === "prisoner-cell" ? prisonerCell() : officeClock();
    const manifestPath = `${DIR}/${name}.assets.json`;
    const packagePath = `${DIR}/${name}.render.json`;
    const m = fmt(JSON.stringify(manifest), manifestPath);
    const p = fmt(
      JSON.stringify({ ...pkg, assetManifest: { uri: manifestPath, sha256: sha(m) } }),
      packagePath,
    );
    return { name, manifestPath, packagePath, manifest: m, pkg: p };
  });
}

if (process.argv.includes("--write")) {
  for (const f of generate()) {
    mkdirSync(join(ROOT, DIR), { recursive: true });
    writeFileSync(join(ROOT, f.manifestPath), f.manifest);
    writeFileSync(join(ROOT, f.packagePath), f.pkg);
    console.info(`wrote ${f.packagePath} and ${f.manifestPath}`);
  }
}
