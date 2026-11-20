/**
 * The Asset Manifest a staged film needs. Every drawing the current engine makes in code is a builtin asset,
 * pinned (name, version, fingerprint) to the source file that implements it, with the inputs it depends on
 * declared as parameters.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FacialHair,
  GarmentKind,
  HairStyle,
  type AssetManifest,
  type RenderPackage,
} from "@erkasa/contracts";
import {
  CHANNELS,
  IMPLEMENTATION,
  STANDING,
  drawPerson,
  isDressedLook,
  lookFor,
  type Look,
} from "./legacy.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const sha = (abs: string): string => createHash("sha256").update(readFileSync(abs)).digest("hex");
const hashes = new Map<string, string>();
/** The hash of the file (or files, concatenated in order) that implement a builtin. */
export const fingerprintOf = (file: keyof typeof IMPLEMENTATION): string => {
  const paths: readonly string[] =
    typeof IMPLEMENTATION[file] === "string"
      ? [IMPLEMENTATION[file] as string]
      : (IMPLEMENTATION[file] as readonly string[]);
  const key = paths.join("+");
  let h = hashes.get(key);
  if (!h) {
    h =
      paths.length === 1
        ? sha(join(ROOT, paths[0] as string))
        : createHash("sha256")
            .update(Buffer.concat(paths.map((p) => readFileSync(join(ROOT, p)))))
            .digest("hex");
    hashes.set(key, h);
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

/**
 * The cutout rig. Version 1 draws the plain look (colour slots); version 2 is the same body that also draws
 * clothes garment by garment, hair styles and facial hair (garments.ts), and declares them, so the gate can refuse a
 * package that asks it for something it does not draw. Films without dressed people keep version 1, unchanged.
 */
export function rig(build: "man" | "woman", dressed = false): Asset {
  // height: from the feet to the top of the head of the rig standing at rest, as drawPerson reports it
  const d = drawPerson(STANDING, { x: 0, y: 0, facing: 1, turn: 1, scale: 1 }, lookFor({ build }));
  return {
    id: `rig_cutout_${build}`,
    version: dressed ? 2 : 1,
    ...(dressed
      ? {
          garments: [...GarmentKind.options],
          hairStyles: [...HairStyle.options],
          facialHair: [...FacialHair.options],
        }
      : {}),
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
    const key = `${a.id}@${a.version}`;
    if (!this.assets.has(key)) this.assets.set(key, a);
    return key;
  }
  build(id: string): AssetManifest {
    return { schema: "erkasa.assets/1", id, assets: [...this.assets.values()] };
  }
}

/** An actor of a scene: rig, colours and, for a dressed person, what they wear and their features. */
export function actorEntry(
  M: ManifestBuilder,
  id: string,
  look: Look,
  opts: { shadow: boolean; rim: boolean },
): RenderPackage["scenes"][number]["actors"][number] {
  const dressed = isDressedLook(look);
  return {
    id,
    rig: M.use(rig(look.build, dressed)),
    layer: `actor_${id}`,
    appearance: {
      coat: look.coat,
      coatDark: look.coatDark,
      pants: look.pants,
      skin: look.skin,
      skinShade: look.skinShade,
      hair: look.hair,
    },
    shadow: opts.shadow,
    rim: opts.rim,
    ...(look.wardrobe?.length ? { wardrobe: look.wardrobe } : {}),
    ...(look.features ? { features: look.features } : {}),
  };
}
