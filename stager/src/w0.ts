/**
 * Stages W0 (the 2.5D office): W0 plan + script → Render Package + Asset Manifest.
 *
 * Frames are those the W0 renderer writes: frame k at T = k / FPS, drawn by the shot whose [start, end) holds T,
 * at local time T - start. While a shot fades in (0.5 s), the previous one is drawn at `dur + t`; those frames are
 * recorded into the previous scene with those times.
 *
 * What is recorded exactly: camera, the changing state of the place (time, light, door, lamp, clock, binders),
 * every input of every person, the props, type and captions. What W0 does on top in its compositor (light map,
 * cast shadow, rim light, window beam, bloom, vignette, grain) is not expressed by the contract's lights yet;
 * see the E1.2 report.
 */
import type { AssetManifest, RenderPackage, Script } from "@erkasa/contracts";
import {
  FPS,
  H,
  W,
  W0_DEPTH,
  W0_FADE_SEC,
  W0_REF,
  WORLD_H,
  WORLD_W,
  fontFiles,
  prepareW0,
  propAt,
  type ActorPerf,
  type W0Prepared,
  type W0PreparedShot,
} from "./legacy.js";
import { ManifestBuilder, UNBOUNDED, fontAsset, procedural, rig } from "./manifest.js";
import { SceneRecorder } from "./recorder.js";
import { node, recordActor, type SceneFrame, type Staged } from "./v2.js";

type Scene = RenderPackage["scenes"][number];
type Layer = Scene["layers"][number];
type Overlay = RenderPackage["overlays"][number];

type W0Plan = Parameters<typeof prepareW0>[0];

/** Scene frames of every W0 shot (own frames, then the frames where the next shot fades in over it). */
export function w0SceneFrames(P: W0Prepared): SceneFrame[][] {
  const n = Math.round(P.duration * FPS);
  const own: SceneFrame[][] = P.shots.map(() => []);
  const tail: SceneFrame[][] = P.shots.map(() => []);
  for (let k = 0; k < n; k++) {
    const T = k / FPS;
    let i = P.shots.findIndex((s) => T >= s.start && T < s.end);
    if (i < 0) i = P.shots.length - 1;
    const s = P.shots[i] as W0PreparedShot;
    const t = T - s.start;
    own[i]?.push({ frame: k, t });
    const prev = P.shots[i - 1];
    if (prev && s.w.shot.transition === "fade" && t < W0_FADE_SEC)
      tail[i - 1]?.push({ frame: k, t: prev.dur + t, tail: true });
  }
  return own.map((o, i) => [...o, ...(tail[i] ?? [])]);
}

/** COPY of the W0 composer's depth of field (blur in px) for a shot. */
function blurs(ps: W0PreparedShot): { far: number; wall: number; mid: number; people: number } {
  const framing = ps.w.cam.framing ?? "medium";
  const onWall = (ps.w.cam.subject ?? "").startsWith("wall:");
  const wall =
    ps.w.dof?.wall ??
    (onWall ? 0 : framing === "wide" ? 0 : framing === "medium" ? 2.2 : framing === "close" ? 4.2 : 5.5);
  return {
    far: wall + 2 > 0.4 ? wall + 2 : 0,
    wall,
    mid: ps.w.dof?.mid ?? (onWall ? 4.5 : 0),
    people: onWall ? 4.5 : 0,
  };
}

const STATE = ["t", "light", "door", "lamp", "clockMin", "binders"] as const;
const RANGE: Record<(typeof STATE)[number], [number, number]> = {
  t: [0, 3600],
  light: [0, 3],
  // the door overshoots to 1.12082 when it opens (EASES.back follow-through, see v2.ts)
  door: UNBOUNDED,
  lamp: [0, 1],
  clockMin: [0, 1440 * 7],
  binders: [0, 1000],
};

export function stageW0(name: string, plan: W0Plan, script: Script): Staged {
  const P = prepareW0(plan, script);
  const errors = P.issues.filter((x) => x.level === "error");
  if (errors.length) throw new Error(`${name}: plan has errors: ${errors.map((e) => e.code).join(", ")}`);
  const M = new ManifestBuilder();
  const place = (id: string, layerName: string, statics: string[]) =>
    M.use(
      procedural(
        id,
        "w0world",
        { w: WORLD_W, h: WORLD_H },
        [["default", `w0.${layerName}`]],
        [
          ...statics.map((s) => ({ kind: "static" as const, id: s })),
          ...STATE.map((c) => ({ kind: "channel" as const, id: c, range: RANGE[c] })),
        ],
      ),
    );
  const frames = w0SceneFrames(P);
  const scenes: Scene[] = [];
  const edit: RenderPackage["edit"] = [];

  P.shots.forEach((ps, i) => {
    const fr = frames[i] as SceneFrame[];
    const first = fr[0];
    if (!first) throw new Error(`${name}: shot ${i} has no frames`);
    const id = `s${String(i + 1).padStart(2, "0")}_${ps.w.shot.id}`.replace(/[^A-Za-z0-9_-]/g, "_");
    const rec = new SceneRecorder(FPS, first.frame);
    const cam = { kind: "camera" } as const;
    const perf = ps.perf;
    const actors = perf ? [...perf.actors.values()] : [];
    const props = perf ? [...perf.props.entries()] : [];
    const placeNodes = ["sky", "city", "city_near", "wall", "mid", ...(ps.w.near ? ["near"] : [])];
    let order: string | undefined;
    for (const f of fr) {
      const t = f.t;
      rec.frame();
      const c = ps.cam(t);
      rec.set(cam, "x", c.cx);
      rec.set(cam, "y", c.cy);
      rec.set(cam, "height", c.height);
      const st = P.state(ps.start + t, perf?.door.at(t) ?? 0, ps.light(t));
      for (const n of placeNodes)
        for (const k of STATE) rec.set({ kind: "node", id: n }, `param.${k}`, st[k]);
      const o = [...actors]
        .sort((a, b) => a.x.at(t) - b.x.at(t))
        .map((a) => a.id)
        .join(",");
      if (order === undefined) order = o;
      else if (o !== order) throw new Error(`${id}: people change drawing order at ${t.toFixed(2)} s`);
      for (const a of actors) recordActor(rec, a, t);
      for (const [pid, pr] of props) {
        let holder: string | null = null;
        for (const e of pr.events) if (e.t <= t) holder = e.holder;
        const p = propAt(pr, t, perf?.actors ?? new Map());
        rec.set({ kind: "node", id: `${pid}_rest` }, "x", p[0]);
        rec.set({ kind: "node", id: `${pid}_rest` }, "y", p[1]);
        rec.set({ kind: "node", id: `${pid}_held` }, "x", p[0]);
        rec.set({ kind: "node", id: `${pid}_held` }, "y", p[1] - 4);
        rec.set(
          { kind: "node", id: `${pid}_held` },
          "param.facing",
          holder ? (perf?.actors.get(holder)?.facingAt(t) ?? 1) : 1,
        );
        rec.set({ kind: "node", id: `${pid}_held` }, "param.rot", 0);
        rec.show(`${pid}_rest`, !holder);
        rec.show(`${pid}_held`, !!holder);
      }
      if (ps.w.shot.text && ps.textAt !== undefined) {
        rec.set({ kind: "node", id: "type" }, "param.t", t);
        // W0 draws a shot's type only while it is the current shot, never under the next shot's fade
        rec.show("type", !f.tail);
      }
    }

    const propAsset = (kind: string): string =>
      M.use(
        procedural(
          `prop_${kind}`,
          "props",
          { w: 120, h: 120 },
          [
            ["resting", `prop.${kind}.resting`],
            ["held", `prop.${kind}.held`],
          ],
          [
            { kind: "channel", id: "facing", range: [-1, 1] },
            { kind: "channel", id: "rot", range: [-360, 360] },
          ],
        ),
      );
    const b = blurs(ps);
    const world = plan.world as unknown;
    const L = (lid: string, depth: number, blur: number, lit: boolean, nodes: Layer["nodes"]): Layer => ({
      id: lid,
      depth,
      blur,
      lit,
      nodes,
    });
    const ordered = (order ?? "").split(",").filter(Boolean);
    const layers: Layer[] = [
      L("sky", W0_DEPTH.sky, b.far, false, [node("sky", place("place_w0_sky", "sky", []), "default")]),
      L("city", W0_DEPTH.city, b.far, false, [
        node("city", place("place_w0_city", "city", ["seed", "near"]), "default", {
          seed: plan.world.seed,
          near: false,
        }),
      ]),
      L("city_near", W0_DEPTH.cityNear, b.far, false, [
        node("city_near", place("place_w0_city", "city", ["seed", "near"]), "default", {
          seed: plan.world.seed + 5,
          near: true,
        }),
      ]),
      L("wall", W0_DEPTH.wall, b.wall, true, [
        node("wall", place("place_w0_wall", "wall", ["world"]), "default", { world }),
      ]),
      L("mid", W0_DEPTH.mid, b.mid, true, [
        node("mid", place("place_w0_mid", "mid", ["world"]), "default", { world }),
        ...props.map(([pid, pr]) => node(`${pid}_rest`, propAsset(pr.kind), "resting")),
      ]),
      ...ordered.map((a) => L(`actor_${a}`, 0, b.people, true, [])),
      L(
        "held",
        0,
        b.people,
        true,
        props.map(([pid, pr]) => node(`${pid}_held`, propAsset(pr.kind), "held")),
      ),
      ...(ps.w.near
        ? [L("near", W0_DEPTH.near, 18, true, [node("near", place("place_w0_near", "near", []), "default")])]
        : []),
    ];
    const text = ps.w.shot.text;
    const screen =
      text && ps.textAt !== undefined
        ? [
            {
              id: "type",
              nodes: [
                node(
                  "type",
                  M.use(
                    procedural(
                      "type_w0",
                      "w0composer",
                      { w: W, h: H },
                      [["default", "type.w0"]],
                      [
                        ...["lines", "place", "at", "out"].map((s) => ({ kind: "static" as const, id: s })),
                        { kind: "channel", id: "t", range: [0, 3600] },
                      ],
                    ),
                  ),
                  "default",
                  { lines: text.lines, place: text.place, at: ps.textAt, out: ps.textOut ?? null },
                ),
              ],
            },
          ]
        : undefined;

    scenes.push({
      id,
      bounds: { x: 0, y: 0, w: WORLD_W, h: WORLD_H },
      background: "#0C1529",
      // provisional: W0's projection (reference height 2140, distance growing with height^0.55); see the report
      camera: { projection: "parallax", referenceDistance: W0_REF.height, dolly: 0.55, aperture: 0 },
      layers,
      ...(screen ? { screen } : {}),
      actors: ordered.map((aid) => {
        const a = perf?.actors.get(aid) as ActorPerf;
        return {
          id: aid,
          rig: M.use(rig(a.look.build)),
          layer: `actor_${aid}`,
          appearance: {
            coat: a.look.coat,
            coatDark: a.look.coatDark,
            pants: a.look.pants,
            skin: a.look.skin,
            skinShade: a.look.skinShade,
            hair: a.look.hair,
          },
          shadow: true,
          rim: true,
        };
      }),
      lights: [],
      tracks: rec.tracksOut(),
      contacts: [],
      events: rec.eventsOut(),
    });
  });

  // edit: each scene from its shot's exact start to the next shot's (E1.4, PO decision): the frames are assigned as
  // W0 assigns them (start <= T < next start) and a dissolve's progress is measured from the shot's start, as the
  // W0 compositor measures it (renderFrame: EASES.io(t / 0.5) with t = T - start)
  const total = Math.round(P.duration * FPS);
  P.shots.forEach((ps, i) => {
    const fade = i > 0 && ps.w.shot.transition === "fade";
    const next = P.shots[i + 1];
    edit.push({
      scene: (scenes[i] as Scene).id,
      start: i === 0 ? 0 : ps.start,
      end: next ? next.start : total / FPS,
      enter: { kind: fade ? "dissolve" : "cut", duration: fade ? W0_FADE_SEC : 0 },
    });
  });

  // captions: film-level, grouped by the size the W0 renderer gives a phrase (it depends on its length)
  const font = M.use(fontAsset("font_montserrat_extrabold", fontFiles()[2] as string, 800));
  const bySize = new Map<
    number,
    Array<{ in: number; out: number; words: Array<{ text: string; t: number; end: number }> }>
  >();
  for (const cap of P.captions) {
    const line = cap.words.map((w) => w.w).join(" ");
    const size = Math.min(58, Math.floor(1700 / Math.max(10, line.length)));
    const words = cap.words.map((w, k) => {
      const nx = cap.words[k + 1];
      return { text: w.w, t: Math.max(0, w.t - 0.02), end: nx ? nx.t - 0.02 : w.end + 0.25 };
    });
    const list = bySize.get(size) ?? [];
    list.push({ in: Math.max(0, cap.t0 - 0.05), out: cap.t1, words });
    bySize.set(size, list);
  }
  const overlays: Overlay[] = [...bySize.entries()]
    .sort(([a], [b]) => b - a)
    .map(([size, phrases]) => ({
      kind: "captions",
      id: `captions_${size}`,
      style: {
        font,
        size,
        color: "#FBF6EC",
        stroke: { color: "#0C1529", width: 12 },
        align: "center",
      },
      at: { x: 0.5, y: 1640 / H },
      highlight: "#F4A261",
      phrases,
    }));

  const manifest: AssetManifest = M.build(`${name}.assets.1`);
  const pkg: RenderPackage = {
    schema: "erkasa.render/1",
    id: `${name}.v1`,
    producer: { name: "@erkasa/stager", version: "0.1.0" },
    output: { width: W, height: H, fps: FPS, duration: total / FPS },
    assetManifest: { uri: `${name}.assets.json`, sha256: "0".repeat(64) },
    scenes,
    edit,
    overlays,
    audio: [],
    // the loudness the W0 renderer normalises to (w0/cli.ts loudnorm I=-16, TP=-1.5); audio is not staged in E1.2
    mix: { duckMusicDb: 0, loudness: { integratedLufs: -16, truePeakDb: -1.5 } },
  };
  return { pkg, manifest };
}
