/**
 * The Asset Manifest a staged film needs. Every drawing the current engine makes in code is a builtin asset,
 * pinned (name, version, fingerprint) to the source file that implements it, with the inputs it depends on
 * declared as parameters.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetManifest } from "@erkasa/contracts";
import { CHANNELS, IMPLEMENTATION, STANDING, drawPerson, lookFor } from "./legacy.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const sha = (abs: string): string => createHash("sha256").update(readFileSync(abs)).digest("hex");
const hashes = new Map<string, string>();
export const fingerprintOf = (file: keyof typeof IMPLEMENTATION): string => {
  const path = IMPLEMENTATION[file];
  let h = hashes.get(path);
  if (!h) {
    h = sha(join(ROOT, path));
    hashes.set(path, h);
  }
  return h;
};

type Asset = AssetManifest["assets"][number];
type Param = { kind: "channel"; id: string; range: [number, number] } | { kind: "static"; id: string };

const builtin = (name: string, impl: keyof typeof IMPLEMENTATION) =>
  ({ kind: "builtin", name, version: 1, fingerprint: fingerprintOf(impl) }) as const;
const common = {
  style: { kit: "erkasa_editorial_night_v1" },
  provenance: { origin: "builtin" },
  approval: { status: "approved", note: "Drawn in code by the engine before E1." },
  license: "LicenseRef-Erkasa-Original",
} as const;

/** A procedural vector asset with one builtin per state. */
export function procedural(
  id: string,
  impl: keyof typeof IMPLEMENTATION,
  size: { w: number; h: number },
  states: Array<[state: string, builtinName: string]>,
  parameters: Param[],
): Asset {
  const [first] = states;
  if (!first) throw new Error(`${id}: no states`);
  return {
    id,
    version: 1,
    kind: "vector",
    format: "svg",
    source: builtin(first[1], impl),
    geometry: { viewBox: [0, 0, size.w, size.h], size, origin: [0, 0] },
    states: states.map(([name, b]) => ({ name, source: builtin(b, impl) })),
    defaultState: first[0],
    affordances: [],
    pivots: [],
    ...(parameters.length ? { parameters } : {}),
    ...common,
  };
}

/** Rig bones and non-bone channels of the procedural person (film/src/rig.ts `Pose`), plus `glow`. */
export const BONES = [
  "torso",
  "head",
  "arm",
  "fore",
  "armF",
  "foreF",
  "thigh",
  "shin",
  "thighF",
  "shinF",
] as const;
export const RIG_CHANNELS = [...CHANNELS.filter((c) => !(BONES as readonly string[]).includes(c)), "glow"];
const PARENT: Record<string, string> = {
  head: "torso",
  arm: "torso",
  armF: "torso",
  fore: "arm",
  foreF: "armF",
  shin: "thigh",
  shinF: "thighF",
};

/**
 * A declared range describes the values a channel carries in the package, not where the drawing clips them.
 *
 * The staging code layers mood, action and idle motion, so a channel can leave the interval drawPerson clips it
 * to when it draws (measured in the six films: gx -1.14..1.12, gy -1.47..1.50, brow -2.00..0.80, lid 0..1.08;
 * drawPerson clips gx and gy to ±1, brow and mouth to ±1.2, lid and open to 0..1, shrug to -0.8..1.2, hand to
 * 0..1). The package keeps the unclipped values, so the picture and the numbers stay exactly the engine's, and
 * rig.ts accepts any number on every channel: the range of every channel is the widest finite one. (E1.2
 * declared the clip intervals here, which the stored values contradicted; E1.3's gate refused them.)
 */
export const UNBOUNDED: [number, number] = [-Number.MAX_VALUE, Number.MAX_VALUE];

export function rig(build: "man" | "woman"): Asset {
  // height: from the feet to the top of the head of the rig standing at rest, as drawPerson reports it
  const d = drawPerson(STANDING, { x: 0, y: 0, facing: 1, turn: 1, scale: 1 }, lookFor({ build }));
  return {
    id: `rig_cutout_${build}`,
    version: 1,
    kind: "rig",
    format: "erkasa.rig.cutout/1",
    source: builtin(`rig.cutout.${build}`, "rig"),
    height: d.feet - d.top,
    bones: BONES.map((id) => (PARENT[id] ? { id, parent: PARENT[id] } : { id })),
    channels: RIG_CHANNELS.map((id) => ({ id, range: UNBOUNDED })),
    sockets: [
      { id: "hand", bone: "fore" },
      { id: "handF", bone: "foreF" },
    ],
    slots: ["coat", "coatDark", "pants", "skin", "skinShade", "hair"],
    ...common,
  };
}

export function fontAsset(id: string, file: string, weight: number): Asset {
  return {
    id,
    version: 1,
    kind: "font",
    format: "ttf",
    source: { kind: "builtin", name: `font.montserrat-${weight}`, version: 1, fingerprint: sha(file) },
    family: "Montserrat",
    weight,
    ...common,
    provenance: { origin: "builtin", by: "Google Fonts (@expo-google-fonts/montserrat)" },
    license: "OFL-1.1",
  };
}

/** Collects the assets a film uses, once each, in first-use order. */
export class ManifestBuilder {
  private readonly assets = new Map<string, Asset>();
  use(a: Asset): string {
    if (!this.assets.has(a.id)) this.assets.set(a.id, a);
    return `${a.id}@${a.version}`;
  }
  build(id: string): AssetManifest {
    return { schema: "erkasa.assets/1", id, assets: [...this.assets.values()] };
  }
}
