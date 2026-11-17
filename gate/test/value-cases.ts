/**
 * E1.4 final audit F1–F3: the values the engine's capabilities declare, refused when a package writes anything
 * else (one-fault packages, each with its exact findings; K5 renders each and requires 0 frames), and accepted
 * when it writes what they allow (VALUE_POSITIVE: the gate passes them and the renderer draws them).
 *
 * F1 every static parameter of every builtin: wrong type, wrong structure, a value outside the allowed set.
 * F2 facing (held props' param.facing, actors' facing): only −1 and 1, changed only by `hold`.
 * F3 roles as declared: members, the value sources (`first`, another role, `absent`).
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- cases over known package shapes */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import type { ExecCase, Start } from "./executable-cases.js";
import { film, type Film } from "./helpers.js";

type Pkg = RenderPackage;
type Scene = Pkg["scenes"][number];
type Track = Scene["tracks"][number];

const of =
  (f: Film): (() => Start) =>
  () => ({ ...film(f), root: mkdtempSync(join(tmpdir(), `gate-${f}-`)) });

/** The first node drawn by `builtin` in the package: its params, and where it is. */
function nodeOf(
  c: { pkg: Pkg; manifest: AssetManifest },
  builtin: string,
): { params: Record<string, unknown>; scene: Scene; id: string } {
  const named = new Map(c.manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
  for (const scene of c.pkg.scenes)
    for (const l of [...scene.layers, ...(scene.screen ?? [])])
      for (const n of l.nodes) {
        if (n.kind !== "asset") continue;
        const a = named.get(n.asset);
        const st = a?.kind === "vector" ? a.states.find((s) => s.name === n.state) : undefined;
        if (st && "source" in st && st.source.kind === "builtin" && st.source.name === builtin)
          return { params: (n.params ?? {}) as Record<string, unknown>, scene, id: n.id };
      }
  throw new Error(`no ${builtin} in the package`);
}

/** Where the first node of `builtin` is, in the films the cases start from (paths below are written from it). */
const FILMS_OF: Record<string, Film> = {
  "type.kinetic": "b1-why-we-stay",
  "overlay.scrim": "b1-why-we-stay",
  "overlay.ots": "b2-same-answers",
  "template.clock": "b1-why-we-stay",
  "template.scale": "b1-why-we-stay",
  "w0.city": "w0-office",
  "w0.wall": "w0-office",
  "w0.mid": "w0-office",
  "type.w0": "w0-office",
};

/** F1: set one static parameter of the first `builtin` node to `value`. */
const param = (name: string, builtin: string, id: string, value: unknown, expect: string[]): ExecCase => ({
  name: `F1 ${name}`,
  start: of(FILMS_OF[builtin] ?? "b1-why-we-stay"),
  mutate: (c) => {
    nodeOf(c, builtin).params[id] =
      typeof value === "function" ? (value as (v: unknown) => unknown)(nodeOf(c, builtin).params[id]) : value;
  },
  expect,
});

const track = (s: Scene, kind: string, id: string, channel: string): Track =>
  s.tracks.find(
    (t) => t.target.kind === kind && (t.target as { id?: string }).id === id && t.channel === channel,
  )!;
const w0s0 = (c: { pkg: Pkg }): Scene => c.pkg.scenes[0]!;

/** The four templates whose node is in b1; the others in their own films (all twelve take an object). */
/** template · film with its first node · that node's params path */
const TEMPLATES_IN: Array<[string, Film, string]> = [
  ["statement", "b1-why-we-stay", "package/scenes/10/layers/0/nodes/0/params/params"],
  ["clock", "b1-why-we-stay", "package/scenes/0/layers/0/nodes/0/params/params"],
  ["scale", "b1-why-we-stay", "package/scenes/9/layers/0/nodes/0/params/params"],
  ["curves", "b4-one-percent", "package/scenes/6/layers/0/nodes/0/params/params"],
  ["bars", "b5-planning-fallacy", "package/scenes/8/layers/0/nodes/0/params/params"],
  ["counter", "b4-one-percent", "package/scenes/0/layers/0/nodes/0/params/params"],
  ["word_shadow", "b3-every-yes", "package/scenes/0/layers/0/nodes/0/params/params"],
  ["time_strip", "b3-every-yes", "package/scenes/2/layers/0/nodes/0/params/params"],
  ["receipts", "b3-every-yes", "package/scenes/5/layers/0/nodes/0/params/params"],
  ["calendar", "b4-one-percent", "package/scenes/3/layers/0/nodes/0/params/params"],
  ["window_dream", "b1-why-we-stay", "package/scenes/4/layers/0/nodes/0/params/params"],
  ["cards", "b2-same-answers", "package/scenes/1/layers/0/nodes/0/params/params"],
];

export const VALUE_CASES: ExecCase[] = [
  // ---- F1 type.kinetic (style.ts kineticType: lines TypeLine[], y, at, out number|null, dark boolean)
  param("type.kinetic lines a string", "type.kinetic", "lines", "hello", [
    "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines",
  ]),
  param(
    "type.kinetic lines empty",
    "type.kinetic",
    "lines",
    [],
    ["VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines"],
  ),
  param(
    "type.kinetic a line whose text is a number",
    "type.kinetic",
    "lines",
    [{ t: 1 }],
    ["VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines/0/t"],
  ),
  param(
    "type.kinetic a line written {text}",
    "type.kinetic",
    "lines",
    [{ text: "a" }],
    [
      "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines/0/t",
      "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines/0/text",
    ],
  ),
  param(
    "type.kinetic a weight the font has not",
    "type.kinetic",
    "lines",
    [{ t: "a", weight: "heavy" }],
    ["VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines/0/weight"],
  ),
  param(
    "type.kinetic a line size 0",
    "type.kinetic",
    "lines",
    [{ t: "a", size: 0 }],
    ["VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/lines/0/size"],
  ),
  param("type.kinetic y a word", "type.kinetic", "y", "top", [
    "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/y",
  ]),
  param("type.kinetic at a string", "type.kinetic", "at", "1", [
    "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/at",
  ]),
  param("type.kinetic out a word", "type.kinetic", "out", "never", [
    "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/out",
  ]),
  param("type.kinetic dark a word", "type.kinetic", "dark", "yes", [
    "VALUE_UNSUPPORTED package/scenes/0/screen/0/nodes/0/params/dark",
  ]),
  // ---- F1 type.w0 (w0/compositor.ts typeW0Svg)
  param("type.w0 lines a string", "type.w0", "lines", "hello", [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/lines",
  ]),
  param("type.w0 place middle", "type.w0", "place", "middle", [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/place",
  ]),
  param("type.w0 at null", "type.w0", "at", null, [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/at",
  ]),
  param("type.w0 out a word", "type.w0", "out", "soon", [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/out",
  ]),
  // ---- F1 overlays (v2frame.ts scrimRect, otsShoulder)
  param("overlay.scrim place middle", "overlay.scrim", "place", "middle", [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/place",
  ]),
  param("overlay.scrim place a number", "overlay.scrim", "place", 2, [
    "VALUE_UNSUPPORTED package/scenes/2/screen/0/nodes/0/params/place",
  ]),
  param("overlay.ots facing 0", "overlay.ots", "facing", 0, [
    "VALUE_UNSUPPORTED package/scenes/8/screen/0/nodes/0/params/facing",
  ]),
  param("overlay.ots facing 0.5", "overlay.ots", "facing", 0.5, [
    "VALUE_UNSUPPORTED package/scenes/8/screen/0/nodes/0/params/facing",
  ]),
  param("overlay.ots dur 0", "overlay.ots", "dur", 0, [
    "VALUE_UNSUPPORTED package/scenes/8/screen/0/nodes/0/params/dur",
  ]),
  param("overlay.ots dur a string", "overlay.ots", "dur", "1", [
    "VALUE_UNSUPPORTED package/scenes/8/screen/0/nodes/0/params/dur",
  ]),
  // ---- F1 templates (templates.ts PARAMS; anchors: name → seconds or null; dur > 0)
  ...TEMPLATES_IN.map(([t, f, at]) => ({
    ...param(`template.${t} params a string`, `template.${t}`, "params", "hello", [
      `VALUE_UNSUPPORTED ${at}`,
    ]),
    start: of(f),
  })),
  param("template.clock time 25 (not h:mm)", "template.clock", "params", { time: "25" }, [
    "VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/params/time",
  ]),
  param(
    "template.clock an input the template does not read",
    "template.clock",
    "params",
    (p: unknown) => ({ ...(p as object), extra: 1 }),
    ["VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/params/extra"],
  ),
  param(
    "template.scale an item on the middle side",
    "template.scale",
    "params",
    (p: unknown) => {
      const q = structuredClone(p) as { items: Array<{ side: string }> };
      q.items[0]!.side = "middle";
      return q;
    },
    ["VALUE_UNSUPPORTED package/scenes/9/layers/0/nodes/0/params/params/items/0/side"],
  ),
  param("template.clock anchors a string", "template.clock", "anchors", "x", [
    "VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/anchors",
  ]),
  param("template.clock an anchor at a string", "template.clock", "anchors", { a: "1" }, [
    "VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/anchors/a",
  ]),
  param("template.clock dur 0", "template.clock", "dur", 0, [
    "VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/dur",
  ]),
  param("template.clock dur a string", "template.clock", "dur", "3", [
    "VALUE_UNSUPPORTED package/scenes/0/layers/0/nodes/0/params/dur",
  ]),
  // ---- F1 W0's place (w0/world.ts WorldParams; city seed, near)
  param("w0.city seed a word", "w0.city", "seed", "x", [
    "VALUE_UNSUPPORTED package/scenes/0/layers/1/nodes/0/params/seed",
  ]),
  param("w0.city near a word", "w0.city", "near", "yes", [
    "CAPABILITY_MISSING package/scenes/0/layers/1",
    "CAPABILITY_MISSING package/scenes/0/layers/1/nodes/0/asset",
    "ROLE_MISSING package/scenes/0/layers",
    "VALUE_UNSUPPORTED package/scenes/0/layers/1/nodes/0/params/near",
  ]),
  param("w0.wall world a string", "w0.wall", "world", "hello", [
    "VALUE_UNSUPPORTED package/scenes/0/layers/3/nodes/0/params/world",
    "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
  ]),
  param(
    "w0.wall world without a palette colour",
    "w0.wall",
    "world",
    (w: unknown) => {
      const q = structuredClone(w) as { palette: Record<string, string> };
      delete q.palette["ink"];
      return q;
    },
    [
      "VALUE_UNSUPPORTED package/scenes/0/layers/3/nodes/0/params/world/palette/ink",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
    ],
  ),
  param(
    "w0.wall world with a colour that is not #rrggbb",
    "w0.wall",
    "world",
    (w: unknown) => {
      const q = structuredClone(w) as { palette: Record<string, string> };
      q.palette["ink"] = "red";
      return q;
    },
    [
      "VALUE_UNSUPPORTED package/scenes/0/layers/3/nodes/0/params/world/palette/ink",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
    ],
  ),
  param(
    "w0.wall world with an input the drawing does not read",
    "w0.wall",
    "world",
    (w: unknown) => ({ ...(w as object), extra: 1 }),
    [
      "VALUE_UNSUPPORTED package/scenes/0/layers/3/nodes/0/params/world/extra",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
    ],
  ),

  param("w0.mid world a string", "w0.mid", "world", "hello", [
    "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
    "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world",
  ]),

  // ---- F2 facing: −1 or 1, changed only by hold
  {
    name: "F2 a held prop facing 0",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "node", "cup_held", "param.facing");
      if (t.kind === "keys") t.keys[0]!.v = 0;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/62/keys/0/v"],
  },
  {
    name: "F2 a held prop facing 0.5",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "node", "cup_held", "param.facing");
      if (t.kind === "keys") t.keys[0]!.v = 0.5;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/62/keys/0/v"],
  },
  {
    name: "F2 a held prop turned from −1 to 1 linearly",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "node", "cup_held", "param.facing");
      if (t.kind === "keys")
        t.keys = [
          { t: 0, v: -1, ease: "linear" },
          { t: 1, v: 1, ease: "linear" },
        ];
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/62/keys/1/ease"],
  },
  {
    name: "F2 a held prop without its facing track",
    start: of("w0-office"),
    mutate: (c) => {
      const s = w0s0(c);
      s.tracks = s.tracks.filter((t) => t !== track(s, "node", "cup_held", "param.facing"));
    },
    expect: ["TRACK_MISSING package/scenes/0/layers/6/nodes/0"],
  },
  {
    name: "F2 a held prop without its rot track",
    start: of("w0-office"),
    mutate: (c) => {
      const s = w0s0(c);
      s.tracks = s.tracks.filter((t) => t !== track(s, "node", "cup_held", "param.rot"));
    },
    expect: ["TRACK_MISSING package/scenes/0/layers/6/nodes/0"],
  },
  {
    name: "F2 an actor facing 0",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "actor", "dritan", "facing");
      if (t.kind === "keys") t.keys[0]!.v = 0;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/36/keys/0/v"],
  },
  {
    name: "F2 an actor facing 0.5",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "actor", "dritan", "facing");
      if (t.kind === "keys") t.keys[0]!.v = 0.5;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/36/keys/0/v"],
  },
  {
    name: "F2 an actor facing 0.5 in a sampled track",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(c.pkg.scenes[6]!, "actor", "dritan", "facing");
      if (t.kind === "samples") t.values[1] = 0.5;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/6/tracks/36/values/1"],
  },
  {
    name: "F2 an actor turned from 1 to −1 linearly",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "actor", "dritan", "facing");
      if (t.kind === "keys")
        t.keys = [
          { t: 0, v: 1, ease: "linear" },
          { t: 1, v: -1, ease: "linear" },
        ];
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/36/keys/1/ease"],
  },

  // ---- F3 roles: as declared (members, first, another role, absent)
  {
    name: "F3 a held prop in the furniture's layer",
    start: of("w0-office"),
    mutate: (c) => {
      const s = w0s0(c);
      const held = s.layers.find((l) => l.id === "held")!;
      s.layers.find((l) => l.id === "mid")!.nodes.push(...held.nodes);
      held.nodes = [];
    },
    expect: [
      "CAPABILITY_MISSING package/scenes/0/layers/4/nodes/2/asset",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/2",
    ],
  },
  {
    name: "F3 the held props' layer blurred apart from the actor's (blur: actors)",
    start: of("w0-office"),
    mutate: (c) => {
      w0s0(c).layers.find((l) => l.id === "held")!.blur = 9;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/6/blur"],
  },
  {
    name: "F3 the held props' layer at another depth than the furniture's (depth: mid)",
    start: of("w0-office"),
    mutate: (c) => {
      w0s0(c).layers.find((l) => l.id === "held")!.depth = 40;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/6/depth"],
  },
  {
    name: "F3 a second actor layer blurred apart from the first (blur: first)",
    start: of("w0-office"),
    mutate: (c) => {
      const s = w0s0(c);
      const a = s.actors[0]!;
      const j = s.layers.findIndex((l) => l.id === a.layer);
      s.layers.splice(j + 1, 0, { ...structuredClone(s.layers[j]!), id: "actor_two", blur: 1 });
      s.actors.push({ ...structuredClone(a), id: "two", layer: "actor_two" });
      for (const t of s.tracks.filter((x) => x.target.kind === "actor" && x.target.id === a.id))
        s.tracks.push({ ...structuredClone(t), target: { kind: "actor", id: "two" } });
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/6/blur"],
  },
  {
    name: "F3 held props blurred with no person in the scene (absent: blur 0)",
    start: of("w0-office"),
    mutate: (c) => {
      const s = c.pkg.scenes[7]!; // held blur 4.5, actor blur 4.5
      const a = s.actors[0]!;
      s.layers = s.layers.filter((l) => l.id !== a.layer);
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "actor" && t.target.id === a.id));
      s.actors = [];
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/7/layers/5/blur"],
  },
];

/** Packages that write only what the capabilities allow: the gate passes them, the renderer draws them. */
export const VALUE_POSITIVE: Array<{
  name: string;
  start: () => Start;
  mutate: (c: { pkg: Pkg; manifest: AssetManifest }) => void;
  t: number;
  scene: number;
}> = [
  {
    name: "F2 a held prop facing −1 throughout",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "node", "cup_held", "param.facing");
      if (t.kind === "keys") t.keys = [{ t: 0, v: -1, ease: "hold" }];
    },
    scene: 0,
    t: 0.5,
  },
  {
    name: "F2 a held prop turned from −1 to 1 by hold",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "node", "cup_held", "param.facing");
      if (t.kind === "keys")
        t.keys = [
          { t: 0, v: -1, ease: "hold" },
          { t: 1, v: 1, ease: "hold" },
        ];
    },
    scene: 0,
    t: 1.5,
  },
  {
    name: "F2 an actor facing −1, turned to 1 by hold",
    start: of("w0-office"),
    mutate: (c) => {
      const t = track(w0s0(c), "actor", "dritan", "facing");
      if (t.kind === "keys")
        t.keys = [
          { t: 0, v: -1, ease: "hold" },
          { t: 1, v: 1, ease: "hold" },
        ];
    },
    scene: 0,
    t: 0.5,
  },
  {
    name: "F2 an actor without a facing track (the rig's rest, 1)",
    start: of("w0-office"),
    mutate: (c) => {
      const s = w0s0(c);
      s.tracks = s.tracks.filter((t) => t !== track(s, "actor", "dritan", "facing"));
    },
    scene: 0,
    t: 0.5,
  },
  {
    name: "F3 held props unblurred with no person in the scene (absent: blur 0)",
    start: of("w0-office"),
    mutate: (c) => {
      const s = c.pkg.scenes[7]!;
      const a = s.actors[0]!;
      s.layers = s.layers.filter((l) => l.id !== a.layer);
      s.layers.find((l) => l.id === "held")!.blur = 0;
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "actor" && t.target.id === a.id));
      s.actors = [];
    },
    scene: 7,
    t: 0.5,
  },
];
