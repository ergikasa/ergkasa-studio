/**
 * Proof that a staged package reproduces what the engine draws today, frame by frame.
 *
 * Every staged film is serialised and read back from JSON. Every value is read with src/evaluate.ts, the one
 * implementation of the contract's evaluation rules (the renderer of E1.4 must use the same module). Then:
 *
 *   B1–B5   the whole shot body of every frame (camera transform, set, resting props, people, held props, set
 *           front, OTS shoulder, scrim, type; or template and type) is rebuilt from the package alone with the
 *           engine's drawing functions and must equal the engine's body byte for byte;
 *   W0      camera, state of the place, every person, every prop (position, held/resting, facing), type and
 *           captions are rebuilt from the package and must equal the engine's values and its type+caption SVG;
 *   people  in both, every channel is also compared as a number with what the engine computed (bit for bit).
 *
 * The only normalisation anywhere: kineticType's clip-path ids (see `ids`).
 */
import { describe, expect, it } from "vitest";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../src/manifest.js";
import { serialise, stageFilm, BENCH } from "../src/index.js";
import {
  FPS,
  FilmPlan,
  H,
  SETS,
  TEMPLATES,
  W,
  CLOTH_LAG,
  drawPerson,
  isDressedLook,
  swayOf,
  drawProp,
  fmt,
  fontFiles,
  frameAtForTest,
  kineticType,
  otsShoulder,
  parseW0Plan,
  prepareV2,
  prepareW0,
  propAt,
  scrimSvg,
  shotFrames,
  typeSvg,
  w0TypeSvg,
  w0ViewOf,
  type ActorPerf,
  type Look,
  type Pose,
  type PropKind,
  type TypeLine,
} from "./engine.js";
import { sceneFrames, type SceneFrame } from "../src/v2.js";
import { w0SceneFrames } from "../src/w0.js";
import { BONES, RIG_CHANNELS } from "../src/manifest.js";
import {
  frameTime,
  numberAt,
  phraseAt,
  sampleIndex,
  visibleAt,
  wordCurrent,
  wordReached,
} from "@erkasa/contracts";
import { loadPlan, loadScript } from "./films.js";
import { engineFunction, engineText } from "./engine-source.js";

type Scene = RenderPackage["scenes"][number];
type AssetNode = Extract<Scene["layers"][number]["nodes"][number], { kind: "asset" }>;

/**
 * kineticType numbers its clip paths with a module-level counter (`kt1094`), so the same type drawn twice gets
 * different ids: the picture is the same, the text is not. Open before E1.4 (deterministic ids per node).
 */
const ids = (svg: string): string => svg.replace(/(id="|url\(#)kt[A-Za-z0-9_-]*/g, "$1kt#");

/** Reads one scene at one frame, only through src/evaluate.ts. */
class At {
  readonly t: number;
  constructor(
    readonly scene: Scene,
    readonly frame: number,
  ) {
    this.t = frameTime(frame, FPS);
  }
  n(kind: "node" | "actor" | "camera", id: string | undefined, channel: string): number {
    return numberAt(this.scene, kind, id, channel, this.t);
  }
  visible(node: string): boolean {
    return visibleAt(this.scene, node, this.t);
  }
  node(id: string): AssetNode {
    for (const l of [...this.scene.layers, ...(this.scene.screen ?? [])])
      for (const n of l.nodes) if (n.id === id && n.kind === "asset") return n;
    throw new Error(`${this.scene.id}: no node ${id}`);
  }
  has(id: string): boolean {
    return [...this.scene.layers, ...(this.scene.screen ?? [])].some((l) => l.nodes.some((n) => n.id === id));
  }
  params<T>(id: string): T {
    return this.node(id).params as unknown as T;
  }
}

let personFrames = 0;
/** A person from the package: the engine's numbers bit for bit, and the engine's SVG. Returns the SVG. */
function person(at: At, a: ActorPerf, t: number): string {
  const actor = at.scene.actors.find((x) => x.id === a.id);
  if (!actor) throw new Error(`${at.scene.id}: ${a.id} missing`);
  const v = (c: string): number => at.n("actor", a.id, c);
  const pose = {} as Pose;
  for (const b of BONES) pose[b] = v(`bone.${b}`);
  for (const c of RIG_CHANNELS)
    if (c !== "glow") (pose as unknown as Record<string, number>)[c] = v(`channel.${c}`);
  const look: Look = {
    build: actor.rig.startsWith("rig_cutout_woman") ? "woman" : "man",
    ...(actor.appearance as unknown as Omit<Look, "build">),
    ...(actor.wardrobe ? { wardrobe: actor.wardrobe } : {}),
    ...(actor.features ? { features: actor.features } : {}),
  };
  const placed = {
    x: v("root.x"),
    y: v("root.y"),
    facing: v("facing") as 1 | -1,
    turn: v("turn"),
    scale: v("root.scale"),
  };
  const srcPose = a.pose(t) as unknown as Record<string, number>;
  const srcPlaced = a.placed(t) as unknown as Record<string, number>;
  const same = (x: number, y: number, what: string): void => {
    if (!Object.is(x, y) && !(x === 0 && y === 0))
      expect.fail(`${at.scene.id} ${a.id} frame ${at.frame}: ${what} is ${x}, the engine computed ${y}`);
  };
  for (const b of BONES) same(pose[b], srcPose[b] as number, `bone.${b}`);
  for (const c of RIG_CHANNELS)
    same(v(`channel.${c}`), c === "glow" ? a.glow.at(t) : (srcPose[c] as number), `channel.${c}`);
  same(placed.x, srcPlaced.x as number, "root.x");
  same(placed.y, srcPlaced.y as number, "root.y");
  same(placed.facing, srcPlaced.facing as number, "facing");
  same(placed.turn, srcPlaced.turn as number, "turn");
  same(placed.scale, srcPlaced.scale as number, "root.scale");
  const sway = isDressedLook(look)
    ? swayOf(
        new At(at.scene, at.frame - Math.round(CLOTH_LAG * FPS)).n("actor", a.id, "root.x"),
        placed.x,
        placed.facing,
      )
    : 0;
  const svg = drawPerson(pose, placed, look, { glow: v("channel.glow"), id: a.id, sway }).svg;
  if (svg !== a.draw(t).svg) expect.fail(`${at.scene.id} ${a.id} frame ${at.frame}: person SVG differs`);
  personFrames++;
  return svg;
}

const propKind = (n: AssetNode): PropKind => n.asset.replace(/^prop_/, "").replace(/@\d+$/, "") as PropKind;
function propSvg(at: At, n: AssetNode): string {
  if (!at.visible(n.id)) return "";
  const x = at.n("node", n.id, "x");
  const y = at.n("node", n.id, "y");
  return n.state === "held"
    ? drawProp(propKind(n), x, y, {
        facing: at.n("node", n.id, "param.facing") as 1 | -1,
        rot: at.n("node", n.id, "param.rot"),
      })
    : drawProp(propKind(n), x, y, { resting: true });
}

/** Screen layers of a v2 scene: OTS shoulder, then scrim + kinetic type. */
function v2Screen(at: At): string {
  let o = "";
  if (at.has("ots")) {
    const p = at.params<{ facing: 1 | -1; dur: number }>("ots");
    o += otsShoulder(at.n("node", "ots", "param.t"), p.dur, p.facing);
  }
  if (at.has("scrim")) o += scrimSvg(at.params<{ place: "top" | "center" | "bottom" }>("scrim").place);
  if (at.has("type")) {
    const p = at.params<{ lines: TypeLine[]; y: number; at: number; out: number | null; dark: boolean }>(
      "type",
    );
    o += kineticType(at.n("node", "type", "param.t"), p.lines, {
      id: "kt-stager",
      y: p.y,
      at: p.at,
      out: p.out,
      dark: p.dark,
    });
  }
  return o;
}

describe.each(BENCH)("%s: every frame rebuilt from the package equals the engine's", (name) => {
  const pkg = JSON.parse(serialise(stageFilm(name as (typeof BENCH)[number])).pkg) as RenderPackage;
  const { composed } = prepareV2({ plan: FilmPlan.parse(loadPlan(name)), script: loadScript(name) });
  const frames = sceneFrames(composed.shots);

  it("one scene per shot; the edit covers every rendered frame once, in order", () => {
    expect(pkg.scenes.length).toBe(composed.shots.length);
    let next = 0;
    for (const cut of pkg.edit) {
      expect(Math.round(cut.start * FPS)).toBe(next);
      next = Math.round(cut.end * FPS);
    }
    expect(next).toBe(Math.round(pkg.output.duration * FPS));
  });

  it("every sample a frame reads is the one recorded for that frame (no off-by-one in time)", () => {
    pkg.scenes.forEach((scene, i) => {
      const fr = frames[i] as SceneFrame[];
      for (const tr of scene.tracks)
        if (tr.kind === "samples")
          fr.forEach((f, k) => {
            if (sampleIndex(tr, frameTime(f.frame, FPS)) !== k)
              expect.fail(
                `${scene.id} ${tr.channel}: frame ${f.frame} reads ${sampleIndex(tr, frameTime(f.frame, FPS))}, not ${k}`,
              );
          });
    });
  });

  it("own frames: the engine's compositor (frameAt, which takes its own time n / FPS) draws each body at the stager's time", () => {
    let start = 0;
    composed.shots.forEach((s, i) => {
      const own = (frames[i] as SceneFrame[]).filter((f) => !f.tail);
      expect(own.length).toBe(shotFrames(s));
      expect(own[0]?.frame).toBe(start);
      own.forEach((f, n) => {
        if (!ids(frameAtForTest(composed, i, n)).includes(ids(s.draw(f.t).body)))
          expect.fail(
            `${pkg.scenes[i]?.id} frame ${f.frame}: the engine's frame ${n} is not drawn at t=${f.t}`,
          );
      });
      start += shotFrames(s);
    });
  });

  it("transition frames: the engine draws the previous shot where the package keeps it", () => {
    composed.shots.forEach((s, i) => {
      const tail = (frames[i] as SceneFrame[]).filter((f) => f.tail);
      tail.forEach((f, n) =>
        expect(frameAtForTest(composed, i + 1, n).includes(s.draw(f.t).body)).toBe(true),
      );
      if (tail.length)
        expect(
          frameAtForTest(composed, i + 1, tail.length).includes(s.draw(s.dur + tail.length / FPS).body),
        ).toBe(false);
    });
  });

  it("every frame: the whole shot body, byte for byte", () => {
    let checked = 0;
    let ots = 0;
    let scrim = 0;
    composed.shots.forEach((s, i) => {
      const scene = pkg.scenes[i] as Scene;
      for (const f of frames[i] as SceneFrame[]) {
        const at = new At(scene, f.frame);
        const cam = {
          x: at.n("camera", undefined, "x"),
          y: at.n("camera", undefined, "y"),
          h: at.n("camera", undefined, "height"),
        };
        let body: string;
        if (s.shot.kind === "editorial") {
          const z = H / cam.h;
          const dy = (960 - cam.y) * z;
          const p = at.params<{
            params: Record<string, unknown>;
            anchors: Record<string, number | null>;
            dur: number;
          }>("template");
          const tpl = s.shot.template ?? "statement";
          const svg = TEMPLATES[tpl]({
            t: at.n("node", "template", "param.t"),
            dur: p.dur,
            params: p.params,
            at: (a) => p.anchors[a] ?? undefined,
          }).svg;
          body = `<g transform="translate(540 ${fmt(960 + dy)}) scale(${fmt(z)}) translate(-540 -960)">${svg}</g>${v2Screen(at)}`;
        } else {
          const set = SETS[s.shot.set ?? "office"];
          const st = {
            t: at.n("node", "set_back", "param.t"),
            light: at.n("node", "set_back", "param.light"),
            door: at.n("node", "set_back", "param.door"),
          };
          for (const k of ["t", "light", "door"] as const)
            expect(at.n("node", "set_front", `param.${k}`)).toBe(st[k]);
          const layer = (id: string) => scene.layers.find((l) => l.id === id)?.nodes ?? [];
          const props = (id: string) =>
            layer(id)
              .filter((n): n is AssetNode => n.kind === "asset" && n.asset.startsWith("prop_"))
              .map((n) => propSvg(at, n))
              .join("");
          const people = scene.layers
            .filter((l) => l.id.startsWith("actor_"))
            .map((l) => {
              const a = s.perf?.actors.get(l.id.slice("actor_".length));
              if (!a) throw new Error(`${scene.id}: ${l.id}`);
              return person(at, a, f.t);
            })
            .join("");
          const world =
            set.back(st) + props("back") + people + props("held") + set.front(st) + props("front");
          body = `<g transform="translate(${W / 2} ${H / 2}) scale(${fmt(H / cam.h)}) translate(${fmt(-cam.x)} ${fmt(-cam.y)})">${world}</g>${v2Screen(at)}`;
        }
        if (at.has("ots")) ots++;
        if (at.has("scrim")) scrim++;
        if (ids(body) !== ids(s.draw(f.t).body))
          expect.fail(`${scene.id} frame ${f.frame} (t=${f.t}): body differs`);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(900);
    // record which overlays this film exercises (B2 is the film with over-the-shoulder shots)
    expect(scrim + ots).toBeGreaterThan(0);
    counts.set(name, { ots, scrim, frames: checked });
  });
});

const counts = new Map<string, { ots: number; scrim: number; frames: number }>();

describe("w0-office: every frame's inputs rebuilt from the package equal the engine's", () => {
  const written = serialise(stageFilm("w0-office"));
  const pkg = JSON.parse(written.pkg) as RenderPackage;
  const manifest = JSON.parse(written.manifest) as AssetManifest;
  const P = prepareW0(parseW0Plan(loadPlan("w0-office")), loadScript("b1-why-we-stay"));
  const frames = w0SceneFrames(P);
  const captions = pkg.overlays.filter((o) => o.kind === "captions");

  it("the edit covers every rendered frame once, in order; samples read their own frame", () => {
    // E1.4: cuts start at the shot's exact start, so a frame's cut (start <= T < end) is the shot W0 draws, and
    // T - cut.start is the time W0 measures a fade from, bit for bit
    let at = 0;
    for (const cut of pkg.edit) {
      expect(cut.start).toBe(at);
      at = cut.end;
    }
    expect(at).toBe(pkg.output.duration);
    frames.forEach((fr, i) =>
      fr
        .filter((f) => !f.tail)
        .forEach((f) => {
          const T = frameTime(f.frame, FPS);
          const cut = pkg.edit.find((c) => T >= c.start && T < c.end);
          expect(cut?.scene).toBe(pkg.scenes[i]?.id);
          if (!Object.is(T - (cut?.start ?? NaN), f.t)) expect.fail(`frame ${f.frame}: local time differs`);
        }),
    );
    pkg.scenes.forEach((scene, i) =>
      scene.tracks.forEach((tr) => {
        if (tr.kind === "samples")
          (frames[i] as SceneFrame[]).forEach((f, k) =>
            expect(sampleIndex(tr, frameTime(f.frame, FPS))).toBe(k),
          );
      }),
    );
  });

  it("captions use the engine's font: Montserrat 800, pinned to the font file", () => {
    for (const o of captions) {
      const font = manifest.assets.find((a) => `${a.id}@${a.version}` === o.style.font);
      expect(font?.kind === "font" && font.family === "Montserrat" && font.weight === 800).toBe(true);
      const file = fontFiles()[2] as string;
      expect(file.endsWith("Montserrat_800ExtraBold.ttf")).toBe(true);
      expect(font?.source.kind === "builtin" && font.source.fingerprint).toBe(
        createHash("sha256").update(readFileSync(file)).digest("hex"),
      );
    }
  });

  it("captions: every phrase and word of the engine is in the package, with its times", () => {
    const phrases = captions.flatMap((o) => o.phrases.map((p) => ({ o, p })));
    expect(phrases.length).toBe(P.captions.length);
    for (const cap of P.captions) {
      const line = cap.words.map((w) => w.w).join(" ");
      const found = phrases.find(
        ({ p }) => p.out === cap.t1 && p.words.map((w) => w.text).join(" ") === line,
      );
      expect(found, line).toBeDefined();
      expect(found?.o.style.size).toBe(Math.min(58, Math.floor(1700 / Math.max(10, line.length))));
    }
  });

  it("every frame: camera, place, people, props, type and captions", () => {
    let checked = 0;
    let propFrames = 0;
    let captionFrames = 0;
    P.shots.forEach((ps, i) => {
      const scene = pkg.scenes[i] as Scene;
      for (const f of frames[i] as SceneFrame[]) {
        const at = new At(scene, f.frame);
        const c = ps.cam(f.t);
        expect([
          at.n("camera", undefined, "x"),
          at.n("camera", undefined, "y"),
          at.n("camera", undefined, "height"),
        ]).toEqual([c.cx, c.cy, c.height]);
        const st = P.state(ps.start + f.t, ps.perf?.door.at(f.t) ?? 0, ps.light(f.t));
        for (const n of ["sky", "city", "city_near", "wall", "mid", ...(ps.w.near ? ["near"] : [])])
          for (const k of ["t", "light", "door", "lamp", "clockMin", "binders"] as const)
            if (at.n("node", n, `param.${k}`) !== st[k]) expect.fail(`${scene.id} ${n}.${k} @${f.frame}`);
        for (const a of ps.perf?.actors.values() ?? []) person(at, a, f.t);
        // props: who holds them, where they are, how they face, and what is drawn
        for (const [pid, pr] of ps.perf?.props ?? []) {
          let holder: string | null = null;
          for (const e of pr.events) if (e.t <= f.t) holder = e.holder;
          expect(at.visible(`${pid}_held`)).toBe(!!holder);
          expect(at.visible(`${pid}_rest`)).toBe(!holder);
          const p = propAt(pr, f.t, ps.perf?.actors ?? new Map());
          const n = at.node(holder ? `${pid}_held` : `${pid}_rest`);
          expect([at.n("node", n.id, "x"), at.n("node", n.id, "y")]).toEqual(holder ? [p[0], p[1] - 4] : p);
          // the drawing the W0 composer makes for this prop (composer.ts drawShot): resting, or held facing the holder
          const want = holder
            ? drawProp(pr.kind, p[0], p[1] - 4, { facing: ps.perf?.actors.get(holder)?.facingAt(f.t) ?? 1 })
            : drawProp(pr.kind, p[0], p[1], { resting: true });
          expect(propSvg(at, n)).toBe(want);
          propFrames++;
        }
        // type (only on the current shot's own frames) and captions, rebuilt and compared with the engine's SVG
        if (!f.tail) {
          let o = "";
          if (at.has("type")) {
            expect(at.visible("type")).toBe(true);
            const p = at.params<{
              lines: TypeLine[];
              place: "top" | "center" | "bottom";
              at: number;
              out: number | null;
            }>("type");
            const svg = w0TypeSvg(at.n("node", "type", "param.t"), p.lines, p.place, p.at, p.out);
            // W0 draws type above the fade (film level); the package keeps it in the scene. No visible
            // difference in this film only because no type is drawn while a shot fades in: checked here.
            if (i > 0 && ps.w.shot.transition === "fade" && f.t < 0.5) expect(svg).toBe("");
            o += svg;
          }
          const cap = captionSvg(captions, at.t);
          if (cap) captionFrames++;
          o += cap;
          if (ids(o) !== ids(typeSvg(P, ps, f.t)))
            expect.fail(`${scene.id} frame ${f.frame}: type/captions differ`);
        } else if (at.has("type")) expect(at.visible("type")).toBe(false);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(1300);
    expect(propFrames).toBeGreaterThan(0);
    expect(captionFrames).toBeGreaterThan(1000);
  });

  it("frame index: the W0 renderer's own frameIndex (w0/cli.ts, run verbatim) gives the stager's frames", () => {
    const frameIndex = engineFunction<Array<{ i: number; t: number }>>(
      `${engineText("film/src/w0/cli.ts", "function frameIndex(P: Prepared)", "  return out;\n}")}\nreturn frameIndex(P);`,
      ["FPS", "P"],
    );
    const engine = frameIndex(FPS, P);
    const own = new Map<number, { i: number; t: number }>();
    frames.forEach((fr, i) => fr.filter((f) => !f.tail).forEach((f) => own.set(f.frame, { i, t: f.t })));
    expect(own.size).toBe(engine.length);
    engine.forEach((e, k) => {
      const mine = own.get(k);
      if (!mine || mine.i !== e.i || !Object.is(mine.t, e.t))
        expect.fail(`frame ${k}: engine ${e.i}@${e.t}, stager ${mine?.i}@${mine?.t}`);
    });
  });

  it("fades: the renderer's rule (composer.ts renderFrame) puts the previous shot exactly on the stager's tail frames", () => {
    // the rule as the engine writes it; the test fails if the text changes
    engineText("film/src/w0/composer.ts", 'if (prev && tr === "fade" && t < 0.5) {', "prev, prev.dur + t);");
    const tails = frames.flatMap((fr, i) => fr.filter((f) => f.tail).map((f) => ({ i, f })));
    let expected = 0;
    frames.forEach((fr, i) => {
      const ps = P.shots[i];
      const prev = P.shots[i - 1];
      if (!ps || !prev || ps.w.shot.transition !== "fade") return;
      for (const f of fr.filter((x) => !x.tail && x.t < 0.5)) {
        expected++;
        const tail = tails.find((x) => x.f.frame === f.frame);
        expect(tail?.i).toBe(i - 1);
        expect(tail?.f.t).toBe(prev.dur + f.t);
      }
    });
    expect(tails.length).toBe(expected);
  });

  it("props and people: what the W0 composer hands its compositor (viewOf) equals the package on every frame", () => {
    let checked = 0;
    P.shots.forEach((ps, i) => {
      if (!ps.perf) return;
      const scene = pkg.scenes[i] as Scene;
      const layer = (id: string) => scene.layers.find((l) => l.id === id)?.nodes ?? [];
      for (const f of frames[i] as SceneFrame[]) {
        const at = new At(scene, f.frame);
        const propsOf = (id: string): string =>
          layer(id)
            .filter((n): n is AssetNode => n.kind === "asset" && n.asset.startsWith("prop_"))
            .map((n) => propSvg(at, n))
            .join("");
        const v = w0ViewOf(P, ps, f.t);
        expect(propsOf("held")).toBe(v.held);
        expect(propsOf("mid")).toBe(v.resting);
        const people = scene.layers
          .filter((l) => l.id.startsWith("actor_"))
          .map((l) => person(at, ps.perf?.actors.get(l.id.slice(6)) as ActorPerf, f.t))
          .join("");
        if (people !== v.people) expect.fail(`${scene.id} frame ${f.frame}: people differ`);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(1000);
  });

  it("depth of field: the blur of every layer is what the composer hands its compositor", () => {
    // the compositor blurs sky and city only above 0.4 px (compositor.ts); the package writes 0 below that
    const src = readFileSync(join(ROOT, "film/src/w0/compositor.ts"), "utf8");
    expect(src.includes("if (blur.far > 0.4) ctx.filter = `blur(${blur.far.toFixed(1)}px)`;")).toBe(true);
    P.shots.forEach((ps, i) => {
      const want = w0ViewOf(P, ps, 0).blur;
      const got = Object.fromEntries((pkg.scenes[i] as Scene).layers.map((l) => [l.id, l.blur]));
      const far = want.far > 0.4 ? want.far : 0;
      expect([got.sky, got.city, got.city_near], `${i} far`).toEqual([far, far, far]);
      expect(got.wall, `${i} wall`).toBe(want.wall);
      expect(got.mid, `${i} mid`).toBe(want.mid);
      for (const [id, b] of Object.entries(got))
        if (id.startsWith("actor_") || id === "held") expect(b, `${i} ${id}`).toBe(want.people);
      if (ps.w.near) expect(got.near, `${i} near`).toBe(want.near);
    });
  });
});

type CaptionsOverlay = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
/**
 * The W0 look of a captions overlay (the markup W0's typeSvg writes), built from the overlay's fields and the
 * timing rules of src/evaluate.ts. This is the reference a renderer must match for W0 parity.
 */
function captionSvg(overlays: CaptionsOverlay[], T: number): string {
  for (const o of overlays) {
    const ph = phraseAt(o, T);
    if (!ph) continue;
    const inA = Math.max(0, Math.min(1, (T - ph.in) / 0.12));
    const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const spans = (stroke: boolean): string =>
      ph.words
        .map((w) => {
          const fill = stroke
            ? (o.style.stroke?.color ?? "")
            : wordCurrent(w, T)
              ? (o.highlight ?? o.style.color)
              : o.style.color;
          return `<tspan fill="${fill}" fill-opacity="${stroke ? 0.9 : wordReached(w, T) ? 1 : 0.6}">${esc(w.text)} </tspan>`;
        })
        .join("");
    const attrs = `x="${o.at.x * W}" y="${Math.round(o.at.y * H)}" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="${o.style.size}"`;
    return `<g opacity="${inA.toFixed(3)}"><text ${attrs} stroke="${o.style.stroke?.color}" stroke-width="${o.style.stroke?.width}" stroke-linejoin="round" stroke-opacity=".9">${spans(true)}</text><text ${attrs}>${spans(false)}</text></g>`;
  }
  return "";
}

describe("coverage and the proof can fail", () => {
  it("over-the-shoulder and scrim overlays were rebuilt on real frames", () => {
    const total = [...counts.values()].reduce((a, c) => ({ ots: a.ots + c.ots, scrim: a.scrim + c.scrim }), {
      ots: 0,
      scrim: 0,
    });
    expect(total.ots).toBeGreaterThan(0);
    expect(total.scrim).toBeGreaterThan(0);
  });

  it("checked every person on every frame", () => {
    expect(personFrames).toBeGreaterThan(3000);
  });

  it("a sample changed by one part in a billion is caught", () => {
    const pkg = JSON.parse(serialise(stageFilm("b3-every-yes")).pkg) as RenderPackage;
    const tr = pkg.scenes
      .flatMap((s) => s.tracks)
      .find((t) => t.kind === "samples" && t.target.kind === "actor" && t.channel.startsWith("bone."));
    if (!tr || tr.kind !== "samples") throw new Error("no sampled bone in b3");
    tr.values[10] = (tr.values[10] as number) * (1 + 1e-9) + 1e-12;
    const { composed } = prepareV2({
      plan: FilmPlan.parse(loadPlan("b3-every-yes")),
      script: loadScript("b3-every-yes"),
    });
    const i = pkg.scenes.findIndex((s) => s.tracks.includes(tr));
    const f = (sceneFrames(composed.shots)[i] as SceneFrame[])[10] as SceneFrame;
    const actor = [...(composed.shots[i]?.perf?.actors.values() ?? [])].find(
      (a) => "id" in tr.target && a.id === tr.target.id,
    );
    if (!actor) throw new Error("actor not found");
    expect(() => person(new At(pkg.scenes[i] as Scene, f.frame), actor, f.t)).toThrow(
      new RegExp(tr.channel.replace(".", "\\.")),
    );
  });

  it("a changed overlay parameter is caught", () => {
    const pkg = JSON.parse(serialise(stageFilm("b2-same-answers")).pkg) as RenderPackage;
    const { composed } = prepareV2({
      plan: FilmPlan.parse(loadPlan("b2-same-answers")),
      script: loadScript("b2-same-answers"),
    });
    const i = pkg.scenes.findIndex((s) => s.screen?.some((l) => l.id === "ots"));
    expect(i).toBeGreaterThanOrEqual(0);
    const scene = pkg.scenes[i] as Scene;
    const ots = scene.screen?.flatMap((l) => l.nodes).find((n) => n.id === "ots") as AssetNode;
    const p = ots.params as { facing: number };
    const f = (sceneFrames(composed.shots)[i] as SceneFrame[])[5] as SceneFrame;
    const engine = ids(composed.shots[i]?.draw(f.t).body ?? "");
    expect(engine.endsWith(ids(v2Screen(new At(scene, f.frame))))).toBe(true);
    p.facing = -p.facing;
    expect(engine.endsWith(ids(v2Screen(new At(scene, f.frame))))).toBe(false);
  });
});
