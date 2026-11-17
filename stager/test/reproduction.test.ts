/**
 * Proof that a staged package reproduces what the engine draws today, frame by frame.
 *
 * Every staged film is serialised and read back from JSON. For every frame of every scene, the values are
 * decoded with the contract's evaluation rules (keys clamp, samples at floor((t - start) * rate), visibility from
 * events) and fed to the engine's own drawing functions. The result must be identical to what the engine draws
 * for that frame: the person's SVG byte for byte, the camera transform, the set, the props, the template and the
 * type as they appear in the frame. No tolerance anywhere.
 */
import { describe, expect, it } from "vitest";
import type { RenderPackage } from "@erkasa/contracts";
import { serialise, stageFilm, BENCH } from "../src/index.js";
import {
  FPS,
  FilmPlan,
  H,
  SETS,
  TEMPLATES,
  drawPerson,
  drawProp,
  fmt,
  frameAtForTest,
  kineticType,
  parseW0Plan,
  prepareV2,
  prepareW0,
  typeSvg,
  type ActorPerf,
  type Look,
  type Pose,
  type PropKind,
  type TypeLine,
} from "./engine.js";
import { sceneFrames, type SceneFrame } from "../src/v2.js";
import { w0SceneFrames } from "../src/w0.js";
import { BONES, RIG_CHANNELS } from "../src/manifest.js";
import { loadPlan, loadScript } from "./films.js";

type Scene = RenderPackage["scenes"][number];

/**
 * kineticType numbers its clip paths with a module-level counter (`kt1094`), so the same type drawn twice gets
 * different ids: the picture is the same, the text is not. Ids are the only thing normalised in these tests.
 */
const ids = (svg: string): string => svg.replace(/kt\d+/g, "kt#");

/** The contract's evaluation of a scene at an absolute frame. */
class Decoder {
  constructor(
    private readonly scene: Scene,
    private readonly fps: number,
  ) {}
  value(kind: string, id: string | undefined, channel: string, frame: number): number {
    const tr = this.scene.tracks.find(
      (t) =>
        t.target.kind === kind &&
        ("id" in t.target ? t.target.id : undefined) === id &&
        t.channel === channel,
    );
    if (!tr) throw new Error(`${this.scene.id}: no track ${kind}:${id}:${channel}`);
    const t = frame / this.fps;
    if (tr.kind === "samples") {
      const i = Math.min(tr.values.length - 1, Math.max(0, Math.floor((t - tr.start) * tr.rate + 1e-6)));
      return tr.values[i] as number;
    }
    if (tr.keys.length !== 1) throw new Error("the stager writes constant channels as one key");
    return tr.keys[0]?.v as number;
  }
  visible(node: string, frame: number): boolean {
    let v = true;
    for (const e of this.scene.events)
      if (e.node === node && e.t <= frame / this.fps && e.visible !== undefined) v = e.visible;
    return v;
  }
  node(id: string) {
    for (const l of [...this.scene.layers, ...(this.scene.screen ?? [])])
      for (const n of l.nodes) if (n.id === id && n.kind === "asset") return n;
    return undefined;
  }
}

function checkActor(D: Decoder, scene: Scene, a: ActorPerf, f: SceneFrame): void {
  const actor = scene.actors.find((x) => x.id === a.id);
  if (!actor) throw new Error(`${scene.id}: ${a.id} missing`);
  const v = (c: string): number => D.value("actor", a.id, c, f.frame);
  const pose = {} as Pose;
  for (const b of BONES) pose[b] = v(`bone.${b}`);
  for (const c of RIG_CHANNELS)
    if (c !== "glow") (pose as unknown as Record<string, number>)[c] = v(`channel.${c}`);
  const look: Look = {
    build: actor.rig.startsWith("rig_cutout_woman") ? "woman" : "man",
    ...(actor.appearance as Omit<Look, "build">),
  };
  const got = drawPerson(
    pose,
    {
      x: v("root.x"),
      y: v("root.y"),
      facing: v("facing") as 1 | -1,
      turn: v("turn"),
      scale: v("root.scale"),
    },
    look,
    { glow: v("channel.glow"), id: a.id },
  ).svg;
  const want = a.draw(f.t).svg;
  if (got !== want) expect.fail(`${scene.id} ${a.id} frame ${f.frame} (t=${f.t}): person differs`);
  // and the numbers themselves, not only the picture they make (the SVG rounds to 2 decimals)
  const srcPose = a.pose(f.t) as unknown as Record<string, number>;
  const srcPlaced = a.placed(f.t);
  const same = (x: number, y: number, what: string): void => {
    if (!Object.is(x, y) && !(x === 0 && y === 0))
      expect.fail(`${scene.id} ${a.id} frame ${f.frame}: ${what} is ${x}, the engine computed ${y}`);
  };
  for (const b of BONES) same(pose[b], srcPose[b] as number, `bone.${b}`);
  for (const c of RIG_CHANNELS)
    same(v(`channel.${c}`), c === "glow" ? a.glow.at(f.t) : (srcPose[c] as number), `channel.${c}`);
  same(v("root.x"), srcPlaced.x, "root.x");
  same(v("root.y"), srcPlaced.y, "root.y");
  same(v("facing"), srcPlaced.facing, "facing");
  same(v("turn"), srcPlaced.turn, "turn");
  same(v("root.scale"), srcPlaced.scale, "root.scale");
  actorFrames++;
}
let actorFrames = 0;

describe.each(BENCH)("%s: the package reproduces every frame", (name) => {
  const staged = stageFilm(name as (typeof BENCH)[number]);
  const pkg = JSON.parse(serialise(staged).pkg) as RenderPackage;
  const { composed } = prepareV2({ plan: FilmPlan.parse(loadPlan(name)), script: loadScript(name) });
  const frames = sceneFrames(composed.shots);

  it("has one scene per shot, covering every rendered frame once in the edit", () => {
    expect(pkg.scenes.length).toBe(composed.shots.length);
    const total = Math.round(pkg.output.duration * FPS);
    let next = 0;
    for (const cut of pkg.edit) {
      expect(Math.round(cut.start * FPS)).toBe(next);
      next = Math.round(cut.end * FPS);
    }
    expect(next).toBe(total);
  });

  it("transition frames: the engine draws the previous shot exactly where the package keeps it", () => {
    composed.shots.forEach((s, i) => {
      const fr = frames[i] as SceneFrame[];
      const tail = fr.filter((f) => f.t >= s.dur);
      const next = composed.shots[i + 1];
      tail.forEach((f, n) =>
        expect(frameAtForTest(composed, i + 1, n).includes(s.draw(f.t).body)).toBe(true),
      );
      if (next && tail.length)
        expect(
          frameAtForTest(composed, i + 1, tail.length).includes(s.draw(s.dur + tail.length / FPS).body),
        ).toBe(false);
    });
  });

  it("every frame: people, camera, set, props, template and type are identical", () => {
    let checked = 0;
    composed.shots.forEach((s, i) => {
      const scene = pkg.scenes[i] as Scene;
      const D = new Decoder(scene, FPS);
      for (const f of frames[i] as SceneFrame[]) {
        const body = s.draw(f.t).body;
        const cam = {
          x: D.value("camera", undefined, "x", f.frame),
          y: D.value("camera", undefined, "y", f.frame),
          h: D.value("camera", undefined, "height", f.frame),
        };
        if (s.shot.kind === "editorial") {
          const z = H / cam.h;
          const dy = (960 - cam.y) * z;
          expect(
            body.startsWith(
              `<g transform="translate(540 ${fmt(960 + dy)}) scale(${fmt(z)}) translate(-540 -960)">`,
            ),
            `${scene.id} camera @${f.frame}`,
          ).toBe(true);
          const n = D.node("template");
          const p = n?.params as unknown as {
            params: Record<string, unknown>;
            anchors: Record<string, number | null>;
            dur: number;
          };
          const tpl = s.shot.template ?? "statement";
          const svg = TEMPLATES[tpl]({
            t: D.value("node", "template", "param.t", f.frame),
            dur: p.dur,
            params: p.params,
            at: (a) => p.anchors[a] ?? undefined,
          }).svg;
          expect(svg.length).toBeGreaterThan(50);
          expect(body.includes(svg), `${scene.id} template @${f.frame}`).toBe(true);
        } else {
          expect(
            body.startsWith(
              `<g transform="translate(540 960) scale(${fmt(H / cam.h)}) translate(${fmt(-cam.x)} ${fmt(-cam.y)})">`,
            ),
            `${scene.id} camera @${f.frame}`,
          ).toBe(true);
          const set = SETS[s.shot.set ?? "office"];
          const st = {
            t: D.value("node", "set_back", "param.t", f.frame),
            light: D.value("node", "set_back", "param.light", f.frame),
            door: D.value("node", "set_back", "param.door", f.frame),
          };
          expect(set.back(st).length).toBeGreaterThan(100);
          expect(body.includes(set.back(st)), `${scene.id} set back @${f.frame}`).toBe(true);
          expect(body.includes(set.front(st)), `${scene.id} set front @${f.frame}`).toBe(true);
          for (const a of s.perf?.actors.values() ?? []) checkActor(D, scene, a, f);
          for (const [pid, pr] of s.perf?.props ?? []) {
            const held = D.visible(`${pid}_held`, f.frame);
            expect(held).toBe(!D.visible(`${pid}_rest`, f.frame));
            const id = held ? `${pid}_held` : `${pid}_rest`;
            const x = D.value("node", id, "x", f.frame);
            const y = D.value("node", id, "y", f.frame);
            const svg = held
              ? drawProp(pr.kind as PropKind, x, y, {
                  facing: D.value("node", id, "param.facing", f.frame) as 1 | -1,
                  rot: D.value("node", id, "param.rot", f.frame),
                })
              : drawProp(pr.kind as PropKind, x, y, { resting: true });
            expect(body.includes(svg), `${scene.id} ${id} @${f.frame}`).toBe(true);
          }
        }
        const type = D.node("type");
        if (type) {
          const p = type.params as unknown as {
            lines: TypeLine[];
            y: number;
            at: number;
            out: number | null;
            dark: boolean;
          };
          const svg = kineticType(D.value("node", "type", "param.t", f.frame), p.lines, {
            y: p.y,
            at: p.at,
            out: p.out,
            dark: p.dark,
          });
          expect(ids(body).includes(ids(svg)), `${scene.id} type @${f.frame}`).toBe(true);
        }
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(900);
  });
});

describe("w0-office: the package reproduces every frame's inputs", () => {
  const pkg = JSON.parse(serialise(stageFilm("w0-office")).pkg) as RenderPackage;
  const P = prepareW0(parseW0Plan(loadPlan("w0-office")), loadScript("b1-why-we-stay"));
  const frames = w0SceneFrames(P);

  it("the edit covers every rendered frame once, in order", () => {
    let next = 0;
    for (const cut of pkg.edit) {
      expect(Math.round(cut.start * FPS)).toBe(next);
      next = Math.round(cut.end * FPS);
    }
    expect(next).toBe(Math.round(P.duration * FPS));
  });

  it("every frame: camera, the state of the place, people and type are identical", () => {
    let checked = 0;
    P.shots.forEach((ps, i) => {
      const scene = pkg.scenes[i] as Scene;
      const D = new Decoder(scene, FPS);
      for (const f of frames[i] as SceneFrame[]) {
        const c = ps.cam(f.t);
        expect([
          D.value("camera", undefined, "x", f.frame),
          D.value("camera", undefined, "y", f.frame),
          D.value("camera", undefined, "height", f.frame),
        ]).toEqual([c.cx, c.cy, c.height]);
        const st = P.state(ps.start + f.t, ps.perf?.door.at(f.t) ?? 0, ps.light(f.t));
        for (const k of ["t", "light", "door", "lamp", "clockMin", "binders"] as const)
          expect(D.value("node", "wall", `param.${k}`, f.frame), `${scene.id} ${k} @${f.frame}`).toBe(st[k]);
        for (const a of ps.perf?.actors.values() ?? []) checkActor(D, scene, a, f);
        const type = D.node("type");
        if (type) {
          const p = type.params as unknown as {
            lines: TypeLine[];
            place: string;
            at: number;
            out: number | null;
          };
          const y = p.place === "bottom" ? 1300 : p.place === "center" ? 860 : 250;
          const svg = kineticType(D.value("node", "type", "param.t", f.frame), p.lines, {
            y,
            at: p.at,
            out: p.out,
          });
          expect(ids(typeSvg(P, ps, f.t)).includes(ids(svg)), `${scene.id} type @${f.frame}`).toBe(true);
        }
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(900);
  });
});

describe("the proof can fail", () => {
  it("a sample changed by one part in a billion is caught", () => {
    const pkg = JSON.parse(serialise(stageFilm("b3-every-yes")).pkg) as RenderPackage;
    const tr = pkg.scenes
      .flatMap((s) => s.tracks)
      .find((t) => t.kind === "samples" && t.target.kind === "actor" && t.channel.startsWith("bone."));
    if (!tr || tr.kind !== "samples") throw new Error("no sampled bone in b3");
    const original = tr.values[10] as number;
    tr.values[10] = original * (1 + 1e-9) + 1e-12;
    expect(tr.values[10]).not.toBe(original);
    const { composed } = prepareV2({
      plan: FilmPlan.parse(loadPlan("b3-every-yes")),
      script: loadScript("b3-every-yes"),
    });
    const frames = sceneFrames(composed.shots);
    const i = pkg.scenes.findIndex((s) => s.tracks.includes(tr));
    const scene = pkg.scenes[i] as Scene;
    const f = (frames[i] as SceneFrame[])[10] as SceneFrame;
    const actor = [...(composed.shots[i]?.perf?.actors.values() ?? [])].find(
      (a) => "id" in tr.target && a.id === tr.target.id,
    );
    if (!actor) throw new Error("actor not found");
    expect(() => checkActor(new Decoder(scene, FPS), scene, actor, f)).toThrow(
      new RegExp(tr.channel.replace(".", "\\.")),
    );
  });

  it("checked every person on every frame", () => {
    expect(actorFrames).toBeGreaterThan(3000);
  });
});
