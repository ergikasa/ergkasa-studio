/**
 * Packages broken on purpose, one fault each, on a clean base (B3 + one real file asset), with the exact code(s)
 * and path(s) each must be refused with. Shared by the gate's negative test and the renderer's K5 (E1.4: a refused
 * package yields exactly the gate's findings and no frame).
 */
import { createHash } from "node:crypto";
import { rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { validate, type GateResult, type RenderCapabilities } from "../src/index.js";
import { EXEC_CASES } from "./executable-cases.js";
import { VALUE_CASES } from "./value-cases.js";
import { AUDIO_CASES } from "./audio-cases.js";
import { base, caps, clone, write } from "./helpers.js";

type Pkg = RenderPackage;
type Scene = Pkg["scenes"][number];
export interface Ctx {
  pkg: Pkg;
  manifest: AssetManifest;
  root: string;
  capabilities: RenderCapabilities;
  budgets?: object;
  /** Raw text instead of the package, when the case is about bytes. */
  text?: string;
  keepPin?: boolean;
}

export const B = base();
/** Indices in the base, found once (the cases name paths by them). */
const si = B.pkg.scenes.findIndex(
  (s) => s.actors.length > 0 && (s.screen ?? []).some((l) => l.id === "type"),
);
const S = B.pkg.scenes[si] as Scene;
const actor = S.actors[0]?.id as string;
const ti = (pred: (t: Scene["tracks"][number]) => boolean): number => S.tracks.findIndex(pred);
const tLight = ti(
  (t) => t.target.kind === "node" && t.target.id === "set_back" && t.channel === "param.light",
);
const tBone = ti((t) => t.target.kind === "actor" && t.kind === "samples" && t.channel.startsWith("bone."));
const tCamX = ti((t) => t.target.kind === "camera" && t.channel === "x");
/** A track written as keys (a constant channel), for the key-order and key-time cases. */
const tKeys = ti((t) => t.kind === "keys" && t.target.kind === "camera");
const screenI = (S.screen ?? []).findIndex((l) => l.id === "type");
const typeNodeI = (S.screen?.[screenI]?.nodes ?? []).findIndex((n) => n.id === "type");
const backI = S.layers.findIndex((l) => l.id === "back");
const setNodeI = S.layers[backI]?.nodes.findIndex((n) => n.id === "set_back") as number;
const am = (id: string): number => B.manifest.assets.findIndex((a) => a.id === id);
export const setAsset = B.manifest.assets.findIndex((a) => a.id.startsWith("set_"));
const chairAsset = am("prop_chairfile");
const rigAsset = B.manifest.assets.findIndex((a) => a.kind === "rig");

/** Writes a case to its root and returns exactly what the gate is given. */
export function inputs(c: Ctx): {
  package: string;
  root: string;
  capabilities: RenderCapabilities;
  budgets?: object;
} {
  const w = write(c.pkg, c.manifest, { root: c.root, ...(c.keepPin ? { keepPin: true } : {}) });
  return {
    package: c.text ?? w.text,
    root: w.root,
    capabilities: c.capabilities,
    ...(c.budgets ? { budgets: c.budgets } : {}),
  };
}

export function gate(c: Ctx): GateResult {
  return validate(inputs(c));
}

/** A case on a fresh base, mutated. */
export function broken(k: Case): Ctx {
  const fresh = k.start ? k.start() : base();
  const c: Ctx = { pkg: fresh.pkg, manifest: fresh.manifest, root: fresh.root, capabilities: caps() };
  k.mutate(c);
  return c;
}
const scene = (c: Ctx): Scene => c.pkg.scenes[si] as Scene;
const sp = (...x: Array<string | number>): string => `/scenes/${si}/${x.join("/")}`;

export interface Case {
  name: string;
  /** the package the fault is put into (default: the B3 base) */
  start?: () => { pkg: Pkg; manifest: AssetManifest; root: string };
  mutate: (c: Ctx) => void;
  expect: string[];
}

/** E1.3's 48 and E1.4's EASE_UNDEFINED and SVG_UNSAFE; then G16 (executable-cases.ts). */
const BEFORE_G16: Case[] = [
  { name: "not JSON", mutate: (c) => (c.text = "{"), expect: ["PACKAGE_PARSE package"] },
  {
    name: "unknown major version",
    mutate: (c) => ((c.pkg as { schema: string }).schema = "erkasa.render/2"),
    expect: ["UNKNOWN_VERSION package/schema"],
  },
  {
    name: "schema: fps missing",
    mutate: (c) => delete (c.pkg.output as Partial<Pkg["output"]>).fps,
    expect: ["SCHEMA package/output/fps"],
  },
  {
    name: "manifest changed after pinning",
    mutate: (c) => (c.keepPin = true),
    expect: ["MANIFEST_HASH package/assetManifest/sha256"],
  },
  {
    name: "manifest missing",
    mutate: (c) =>
      (c.text = JSON.stringify({
        ...c.pkg,
        assetManifest: { ...c.pkg.assetManifest, uri: "elsewhere/missing.json" },
      })),
    expect: ["FILE_MISSING package/assetManifest/uri"],
  },
  {
    name: "asset file changed after approval",
    mutate: (c) => writeFileSync(join(c.root, "assets/chair.svg"), "<svg/>"),
    expect: [
      `FILE_HASH manifest/assets/${chairAsset}/source/sha256`,
      `FILE_HASH manifest/assets/${chairAsset}/states/0/source/sha256`,
    ],
  },
  {
    name: "asset file is a symlink out of the root",
    mutate: (c) => {
      rmSync(join(c.root, "assets/chair.svg"));
      symlinkSync("/etc/hostname", join(c.root, "assets/chair.svg"));
    },
    expect: [
      `PATH_ESCAPE manifest/assets/${chairAsset}/source/uri`,
      `PATH_ESCAPE manifest/assets/${chairAsset}/states/0/source/uri`,
    ],
  },
  {
    name: "asset pending approval",
    mutate: (c) =>
      ((c.manifest.assets[chairAsset] as AssetManifest["assets"][number]).approval.status = "pending"),
    expect: [`NOT_APPROVED manifest/assets/${chairAsset}/approval/status`],
  },
  {
    name: "builtin the engine does not carry",
    mutate: (c) => {
      const a = c.manifest.assets[setAsset] as Extract<AssetManifest["assets"][number], { kind: "vector" }>;
      const st = a.states[0] as { source: { name: string } };
      st.source.name = "set.moon.back";
    },
    expect: [`BUILTIN_UNKNOWN manifest/assets/${setAsset}/states/0/source/name`],
  },
  {
    name: "builtin fingerprint of another implementation",
    mutate: (c) =>
      ((c.manifest.assets[setAsset]?.source as { fingerprint: string }).fingerprint = "0".repeat(64)),
    expect: [`BUILTIN_MISMATCH manifest/assets/${setAsset}/source/fingerprint`],
  },
  {
    name: "builtin version the engine does not have",
    mutate: (c) => ((c.manifest.assets[setAsset]?.source as { version: number }).version = 2),
    expect: [`BUILTIN_MISMATCH manifest/assets/${setAsset}/source/version`],
  },
  {
    name: "builtin removed from the engine",
    mutate: (c) => {
      const name = (c.manifest.assets[setAsset]?.source as { name: string }).name;
      (c.capabilities.builtins.find((b) => b.name === name) as { status: string }).status = "removed";
    },
    expect: [
      `BUILTIN_REMOVED manifest/assets/${setAsset}/source/name`,
      `BUILTIN_REMOVED manifest/assets/${setAsset}/states/0/source/name`,
    ],
  },
  {
    name: "a vector drawn by a rig builtin",
    mutate: (c) => {
      const r = c.manifest.assets[rigAsset]?.source;
      (c.manifest.assets[setAsset] as { source: unknown }).source = clone(r);
    },
    expect: [`BUILTIN_KIND manifest/assets/${setAsset}/source/name`],
  },
  {
    name: "node draws an asset not in the manifest",
    mutate: (c) => ((scene(c).layers[backI]?.nodes[setNodeI] as { asset: string }).asset = "set_nowhere@1"),
    expect: [`ASSET_MISSING ${"package" + sp("layers", backI, "nodes", setNodeI, "asset")}`],
  },
  {
    name: "actor's rig is not a rig",
    mutate: (c) => ((scene(c).actors[0] as { rig: string }).rig = `${c.manifest.assets[setAsset]?.id}@1`),
    expect: [`ASSET_KIND package${sp("actors", 0, "rig")}`],
  },
  {
    name: "node in an undeclared state",
    mutate: (c) => ((scene(c).layers[backI]?.nodes[setNodeI] as { state: string }).state = "open"),
    expect: [`STATE_UNDECLARED package${sp("layers", backI, "nodes", setNodeI, "state")}`],
  },
  {
    name: "state change with an fx the engine does not draw",
    mutate: (c) =>
      scene(c).events.push({
        t: c.pkg.edit[si]?.start ?? 0,
        node: "set_back",
        visible: true,
        fx: "glow",
        duration: 0.3,
      }),
    expect: [`FX_UNSUPPORTED package${sp("events", B.pkg.scenes[si]?.events.length ?? 0, "fx")}`],
  },
  {
    name: "static input of a procedural asset missing",
    mutate: (c) =>
      delete (scene(c).screen?.[screenI]?.nodes[typeNodeI] as { params: Record<string, unknown> }).params
        .dark,
    expect: [`PARAM_MISSING package${sp("screen", screenI, "nodes", typeNodeI, "params")}`],
  },
  {
    name: "unknown static input",
    mutate: (c) =>
      ((scene(c).screen?.[screenI]?.nodes[typeNodeI] as { params: Record<string, unknown> }).params.colour =
        "red"),
    expect: [`PARAM_UNKNOWN package${sp("screen", screenI, "nodes", typeNodeI, "params", "colour")}`],
  },
  {
    name: "manifest declares an input the engine does not take",
    mutate: (c) =>
      (c.manifest.assets[setAsset] as { parameters: unknown[] }).parameters.push({
        kind: "channel",
        id: "weather",
        range: [0, 1],
      }),
    expect: [`PARAM_UNSUPPORTED manifest/assets/${setAsset}/parameters/3`],
  },
  {
    name: "manifest omits an input the engine needs",
    mutate: (c) => {
      const a = c.manifest.assets[setAsset] as { parameters: Array<{ id: string }> };
      a.parameters = a.parameters.filter((p) => p.id !== "door");
      for (const s of c.pkg.scenes) s.tracks = s.tracks.filter((t) => t.channel !== "param.door");
    },
    expect: [
      `PARAM_NOT_DECLARED manifest/assets/${setAsset}/parameters`,
      "TRACK_MISSING package/scenes/1/layers/0/nodes/0",
      "TRACK_MISSING package/scenes/1/layers/3/nodes/0",
      "TRACK_MISSING package/scenes/6/layers/0/nodes/0",
      "TRACK_MISSING package/scenes/6/layers/3/nodes/0",
      "TRACK_MISSING package/scenes/7/layers/0/nodes/0",
      "TRACK_MISSING package/scenes/7/layers/3/nodes/0",
    ],
  },
  {
    name: "track on a node that does not exist",
    mutate: (c) => ((scene(c).tracks[tCamX] as { target: unknown }).target = { kind: "node", id: "ghost" }),
    expect: [
      `TARGET_MISSING package${sp("tracks", tCamX, "target", "id")}`,
      "TRACK_MISSING package/scenes/1/camera",
    ],
  },
  {
    name: "bone the rig does not have",
    mutate: (c) => ((scene(c).tracks[tBone] as { channel: string }).channel = "bone.tail"),
    expect: [`CHANNEL_INVALID package${sp("tracks", tBone, "channel")}`],
  },
  {
    name: "two tracks for one channel",
    mutate: (c) => scene(c).tracks.push(clone(scene(c).tracks[tCamX]) as Scene["tracks"][number]),
    expect: [`TRACK_DUPLICATE package${sp("tracks", B.pkg.scenes[si]?.tracks.length ?? 0, "channel")}`],
  },
  {
    name: "light level outside its range",
    mutate: (c) => {
      const t = scene(c).tracks[tLight] as Scene["tracks"][number];
      if (t.kind === "keys") (t.keys[0] as { v: number }).v = 7;
      else t.values[0] = 7;
    },
    expect: [
      `VALUE_RANGE package${sp("tracks", tLight, B.pkg.scenes[si]?.tracks[tLight]?.kind === "keys" ? "keys/0/v" : "values/0")}`,
    ],
  },
  {
    name: "keys out of order",
    mutate: (c) => {
      const t = scene(c).tracks[tKeys] as Extract<Scene["tracks"][number], { kind: "keys" }>;
      t.keys.push({ t: Math.max(0, (t.keys[0]?.t ?? 0) - 0.5), v: 1, ease: "linear" });
    },
    expect: [`KEY_ORDER package${sp("tracks", tKeys, "keys", 1, "t")}`],
  },
  {
    name: "key after the end of the film",
    mutate: (c) =>
      ((
        (scene(c).tracks[tKeys] as Extract<Scene["tracks"][number], { kind: "keys" }>).keys[0] as {
          t: number;
        }
      ).t = 999),
    expect: [`TIME_RANGE package${sp("tracks", tKeys, "keys", 0, "t")}`],
  },
  {
    name: "bone samples not at the film's frame rate",
    mutate: (c) => ((scene(c).tracks[tBone] as { rate: number }).rate = 15),
    expect: [`SAMPLE_RATE package${sp("tracks", tBone, "rate")}`],
  },
  {
    name: "a gap in the edit",
    mutate: (c) => ((c.pkg.edit[1] as { start: number }).start += 0.5),
    expect: ["EDIT_GAP package/edit/1/start"],
  },
  {
    name: "the edit shows a scene that does not exist",
    mutate: (c) => ((c.pkg.edit[0] as { scene: string }).scene = "nowhere"),
    expect: ["EDIT_SCENE package/edit/0/scene"],
  },
  {
    name: "transition longer than its cut",
    mutate: (c) =>
      ((c.pkg.edit[1] as { enter: { kind: string; duration: number } }).enter = {
        kind: "dissolve",
        duration: 3,
      }),
    expect: ["TRANSITION_LENGTH package/edit/1/enter/duration"],
  },
  {
    name: "two scenes with one id",
    mutate: (c) => {
      (c.pkg.scenes[1] as { id: string }).id = c.pkg.scenes[0]?.id as string;
      (c.pkg.edit[1] as { scene: string }).scene = c.pkg.scenes[0]?.id as string;
    },
    expect: ["ID_DUPLICATE package/scenes/1/id"],
  },
  {
    name: "one object held by two people at once",
    mutate: (c) => {
      const s = scene(c);
      const from = c.pkg.edit[si]?.start ?? 0;
      s.contacts.push({ node: "set_back", actor, socket: "hand", from, to: from + 1, offset: [0, 0] });
      s.contacts.push({
        node: "set_back",
        actor,
        socket: "handF",
        from: from + 0.5,
        to: from + 1.5,
        offset: [0, 0],
      });
    },
    expect: [
      `HOLDER_CONFLICT package${sp("contacts", 1)}`,
      "CAPABILITY_MISSING package/scenes/1/contacts/0",
      "CAPABILITY_MISSING package/scenes/1/contacts/1",
    ],
  },
  {
    name: "hand the rig does not have",
    mutate: (c) => {
      const from = c.pkg.edit[si]?.start ?? 0;
      scene(c).contacts.push({ node: "set_back", actor, socket: "tail", from, to: from + 1, offset: [0, 0] });
    },
    expect: [
      `SOCKET_MISSING package${sp("contacts", 0, "socket")}`,
      "CAPABILITY_MISSING package/scenes/1/contacts/0",
    ],
  },
  {
    name: "actor in a layer that does not exist",
    mutate: (c) => ((scene(c).actors[0] as { layer: string }).layer = "nowhere"),
    expect: [`LAYER_MISSING package${sp("actors", 0, "layer")}`],
  },
  {
    name: "appearance misses a slot",
    mutate: (c) => delete (scene(c).actors[0]?.appearance as Record<string, string>).pants,
    expect: [`APPEARANCE_SLOTS package${sp("actors", 0, "appearance")}`],
  },
  {
    name: "projection the engine does not draw",
    mutate: (c) => {
      const { parallax } = c.capabilities.projections;
      c.capabilities.projections = { parallax: parallax as NonNullable<typeof parallax> };
      c.capabilities.transitions = c.capabilities.transitions.filter(
        (t) => t.from === "parallax" && t.to === "parallax",
      );
    },
    expect: B.pkg.scenes.map((_, i) => `CAPABILITY_MISSING package/scenes/${i}/camera/projection`),
  },
  {
    name: "transition the engine does not draw",
    mutate: (c) => ((c.pkg.edit[1] as { enter: { kind: string } }).enter.kind = "dip_to_black"),
    expect: ["CAPABILITY_MISSING package/edit/1/enter/kind"],
  },
  {
    name: "film longer than the budget",
    mutate: (c) => (c.budgets = { durationSec: 10 }),
    expect: ["BUDGET_DURATION package/output/duration"],
  },
  {
    name: "package larger than the budget",
    mutate: (c) => (c.budgets = { packageBytes: JSON.stringify(c.pkg).length - 1 }),
    expect: ["BUDGET_PACKAGE_BYTES package"],
  },
  {
    name: "too many scenes",
    mutate: (c) => (c.budgets = { scenes: 2 }),
    expect: ["BUDGET_SCENES package/scenes"],
  },
  {
    name: "too many nodes in a scene",
    mutate: (c) => (c.budgets = { nodesPerScene: 2 }),
    expect: B.pkg.scenes.flatMap((s, i) =>
      [...s.layers, ...(s.screen ?? [])].reduce((n, l) => n + l.nodes.length, 0) > 2
        ? [`BUDGET_SCENE_NODES package/scenes/${i}`]
        : [],
    ),
  },
  {
    name: "too many nodes in the film",
    mutate: (c) => (c.budgets = { nodes: 5 }),
    expect: ["BUDGET_NODES package/scenes"],
  },
  {
    name: "too many tracks",
    mutate: (c) => (c.budgets = { tracks: 5 }),
    expect: ["BUDGET_TRACKS package/scenes"],
  },
  {
    name: "too many sample values",
    mutate: (c) => (c.budgets = { samples: 5 }),
    expect: ["BUDGET_SAMPLES package/scenes"],
  },
  {
    name: "too many assets",
    mutate: (c) => (c.budgets = { assets: 2 }),
    expect: ["BUDGET_ASSETS manifest/assets"],
  },
  {
    name: "asset file larger than the budget",
    mutate: (c) => (c.budgets = { assetBytes: 100 }),
    expect: [
      `BUDGET_ASSET_BYTES manifest/assets/${chairAsset}/source/uri`,
      `BUDGET_ASSET_BYTES manifest/assets/${chairAsset}/states/0/source/uri`,
    ],
  },
  {
    name: "a key with an ease that has no numeric definition",
    mutate: (c) =>
      ((
        (scene(c).tracks[tKeys] as Extract<Scene["tracks"][number], { kind: "keys" }>).keys[0] as {
          ease: string;
        }
      ).ease = "easeInOut"),
    expect: [`EASE_UNDEFINED package${sp("tracks", tKeys, "keys", 0, "ease")}`],
  },
  {
    name: "an asset SVG that would run a script",
    mutate: (c) => {
      const bad = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
      writeFileSync(join(c.root, "assets/chair.svg"), bad);
      const sha = createHash("sha256").update(bad).digest("hex");
      const a = c.manifest.assets[chairAsset] as {
        source: { sha256: string };
        states: Array<{ source: { sha256: string } }>;
      };
      a.source.sha256 = sha;
      (a.states[0] as { source: { sha256: string } }).source.sha256 = sha;
    },
    expect: [
      `SVG_UNSAFE manifest/assets/${chairAsset}/source/uri`,
      `SVG_UNSAFE manifest/assets/${chairAsset}/states/0/source/uri`,
    ],
  },
  {
    name: "capabilities that cannot be trusted",
    mutate: (c) =>
      c.capabilities.builtins.push(
        clone(c.capabilities.builtins[0]) as RenderCapabilities["builtins"][number],
      ),
    expect: ["CAPABILITIES_INVALID capabilities"],
  },
];

export const CASES: Case[] = [...BEFORE_G16, ...EXEC_CASES, ...VALUE_CASES, ...AUDIO_CASES];
