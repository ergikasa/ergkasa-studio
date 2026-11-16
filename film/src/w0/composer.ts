/**
 * W0 compositor: a film directed from a story and a world, rendered as layers.
 *
 *   sky · city · wall (blurred by depth of field) · cast shadows · furniture · people · near foliage
 *   × a light map (ambient by time of day + window, lamp, door and screen lights)
 *   + rim light on the side of each person that faces the key light · light shafts · bloom · vignette · grain
 *   + kinetic type and captions
 *
 * Vector layers are drawn by Skia's SVG renderer (5x faster than resvg here, same picture), the compositing by
 * Skia's 2D canvas. The world's state (clock, lamp, binders) is one register for the whole film, so what changes
 * in one shot is still changed in the next.
 */
import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Script } from "@erkasa/contracts";
import type { TimedWord } from "@erkasa/compiler";
import { estimateWords } from "@erkasa/compiler";
import { Shot, type CastMember } from "../contract.js";
import { EASES, K, clamp, ramp } from "../motion.js";
import { perform, propAt, type Issue, type Performance } from "../perform.js";
import { carryFrom, checkFilm, type Carry } from "../continuity.js";
import { drawProp } from "../props.js";
import { DEFS, H, W, kineticType } from "../style.js";
import { anchorTime, layoutTiming, shotTimes, type Timing } from "../timing.js";
import { aimAt, lerpCam, project, REF, svgTransform, toScreen, type Cam } from "./camera.js";
import {
  byLight,
  cityLayer,
  DEPTH,
  midLayer,
  nearLayer,
  officeSet,
  skyLayer,
  SPOTS,
  wallLayer,
  WORLD_W,
  type PlaceState,
  type WorldParams,
} from "./world.js";

const M = 48; // margin around every offscreen layer, so blur has pixels to pull from at the frame edge
const CW = W + 2 * M;
const CH = H + 2 * M;
const LIGHT = { day: 0, golden: 1, dusk: 2, night: 3 } as const;

// ------------------------------------------------------------------------------------ the plan

export interface W0CamSpec {
  framing?: "wide" | "medium" | "close" | "insert" | "custom";
  /** A person, a target of the place, or a wall point "wall:x,y". */
  subject?: string;
  move?: "static" | "push_in" | "pull_out" | "drift" | "follow" | "travel";
  /** For travel: where the camera ends (same forms as subject). */
  to?: string;
  height?: number;
  toHeight?: number;
  /** Where the subject sits on screen, fractions of the frame. */
  sx?: number;
  sy?: number;
}

export interface W0Shot {
  shot: Shot;
  cam: W0CamSpec;
  dof?: { wall?: number; mid?: number };
  near?: boolean;
}

export interface WorldEvent {
  shot: string;
  at: string;
  kind: "lamp" | "binders" | "clock_rate";
  value: number;
}

export interface W0Plan {
  title: string;
  cast: CastMember[];
  /** Narration pace: estimated word times are multiplied by this (no voice in W0). */
  pace: number;
  clockStartMin: number;
  world: WorldParams;
  shots: W0Shot[];
  events: WorldEvent[];
}

export function parsePlan(raw: unknown): W0Plan {
  const p = raw as W0Plan & { shots: Array<W0Shot & { shot: unknown }> };
  return { ...p, shots: p.shots.map((s) => ({ ...s, shot: Shot.parse(s.shot) })) };
}

// ------------------------------------------------------------------------------------ preparation

export interface PreparedShot {
  w: W0Shot;
  start: number;
  end: number;
  dur: number;
  perf?: Performance;
  textAt?: number;
  textOut?: number;
  light: (t: number) => number;
  cam: (t: number) => Cam;
  /** Local times of visible events. */
  events: number[];
}

export interface Prepared {
  plan: W0Plan;
  timing: Timing;
  shots: PreparedShot[];
  duration: number;
  issues: Issue[];
  state(absT: number, door: number, light: number): PlaceState;
  captions: Array<{ words: Array<{ w: string; t: number; end: number }>; t0: number; t1: number }>;
  absEvents: Array<{ t: number; kind: string; value: number }>;
}

export function alignmentsFor(script: Script, pace: number): Record<string, TimedWord[]> {
  const out: Record<string, TimedWord[]> = {};
  for (const s of script.scenes)
    out[s.sceneId] = estimateWords(s.narration).map((w) => ({
      ...w,
      start: w.start * pace,
      end: w.end * pace,
    }));
  return out;
}

export function prepare(plan: W0Plan, script: Script): Prepared {
  const timing = layoutTiming(script, alignmentsFor(script, plan.pace));
  const set = officeSet();
  const issues: Issue[] = [];
  const times = shotTimes(timing, {
    schema: "erkasa.film/1",
    title: plan.title,
    voiceId: "none",
    cast: plan.cast,
    shots: plan.shots.map((s) => s.shot),
  });
  const lastOnSet = new Map<string, { perf: Performance; dur: number; index: number }>();
  const carryFor = (setId: string, index: number): Carry | undefined => {
    const l = lastOnSet.get(setId);
    return l ? carryFrom(l.perf, setId, l.dur, l.index === index - 1) : undefined;
  };
  const shots: PreparedShot[] = times.map(({ shot, start, end }, index) => {
    const w = plan.shots[index] as W0Shot;
    const dur = Math.max(0.4, end - start);
    const path = `shots[${index}]`;
    const at = (a: string): number | undefined => {
      const abs = anchorTime(timing, a as Shot["from"], start, shot.scene);
      return abs === undefined ? undefined : abs - start;
    };
    if (dur < 0.9)
      issues.push({
        level: "error",
        code: "SHOT_TOO_SHORT",
        path,
        message: `${shot.id}: ${dur.toFixed(2)} s`,
      });
    const words = timing.words
      .filter((x) => x.t >= start && x.t < end)
      .map((x) => ({ word: x.word, t: x.t - start, end: x.end - x.start + x.t - start }));
    const carry = shot.kind === "set" ? carryFor(set.id, index) : undefined;
    const perf =
      shot.kind === "set"
        ? perform({ set, shot, path, dur, cast: plan.cast, at, words, ...(carry ? { carry } : {}) })
        : undefined;
    if (perf) lastOnSet.set(set.id, { perf, dur, index });
    if (perf) {
      issues.push(...perf.issues);
      // an action that is still going when the shot cuts is lost (the next shot may contradict it)
      const last = Math.max(0, ...perf.events);
      if (last > dur + 0.05)
        issues.push({
          level: "warning",
          code: "ACTION_OVERRUNS_SHOT",
          path,
          message: `${shot.id}: actions end at ${last.toFixed(2)} s, the shot lasts ${dur.toFixed(2)} s`,
        });
    }
    const lightKeys: Array<[number, number]> = [[0, LIGHT[shot.light ?? "golden"]]];
    if (shot.lightTo) {
      const t1 = at(shot.lightTo.at);
      if (t1 !== undefined)
        lightKeys.push([t1, LIGHT[shot.light ?? "golden"]], [t1 + 2.4, LIGHT[shot.lightTo.to]]);
    }
    const light = (t: number): number =>
      K(
        t,
        lightKeys.map(([a, b]) => [a, b, "io"] as const),
      );
    const textAt = shot.text ? at(shot.text.at) : undefined;
    const textOut = shot.text?.out ? at(shot.text.out) : undefined;
    return {
      w,
      start,
      end,
      dur,
      ...(perf ? { perf } : {}),
      ...(textAt !== undefined ? { textAt } : {}),
      ...(textOut !== undefined ? { textOut } : {}),
      light,
      cam: cameraFor(w, perf, dur),
      events: [...(perf?.events ?? []), ...(textAt !== undefined ? [textAt] : [])],
    };
  });
  const duration = shots.length ? (shots[shots.length - 1] as PreparedShot).end : 0;
  issues.push(
    ...checkFilm(shots.map((s) => ({ shot: s.w.shot, dur: s.dur, ...(s.perf ? { perf: s.perf } : {}) })))
      .issues,
  );

  // the world register: every change is an event at an absolute time, read by every later shot
  const absEvents = plan.events.flatMap((e) => {
    const s = shots.find((x) => x.w.shot.id === e.shot);
    if (!s) {
      issues.push({ level: "error", code: "EVENT_SHOT", path: "events", message: `no shot ${e.shot}` });
      return [];
    }
    const t = anchorTime(timing, e.at as Shot["from"], s.start, s.w.shot.scene);
    if (t === undefined) {
      issues.push({ level: "error", code: "EVENT_ANCHOR", path: "events", message: `${e.shot} ${e.at}` });
      return [];
    }
    s.events.push(t - s.start);
    return [{ t, kind: e.kind, value: e.value }];
  });
  const lampKeys = absEvents.filter((e) => e.kind === "lamp");
  const binderKeys = absEvents.filter((e) => e.kind === "binders");
  const rateKeys = absEvents.filter((e) => e.kind === "clock_rate").sort((a, b) => a.t - b.t);
  const clockAt = (T: number): number => {
    // minutes: one per minute of film by default; a clock_rate event changes how fast time passes
    let m = plan.clockStartMin;
    let t0 = 0;
    let rate = 1 / 60;
    for (const r of rateKeys) {
      if (r.t >= T) break;
      m += (r.t - t0) * rate;
      t0 = r.t;
      rate = r.value;
    }
    return m + (T - t0) * rate;
  };
  const state = (T: number, door: number, light: number): PlaceState => {
    let lamp = 0;
    for (const e of lampKeys)
      lamp = T < e.t ? lamp : T < e.t + 0.18 ? (e.value > lamp ? (T - e.t) / 0.18 : lamp) : e.value;
    let binders = plan.world.years.length - 1;
    for (const e of binderKeys) if (T >= e.t) binders = Math.min(e.value, binders + (T - e.t) / 0.55);
    return { t: T, light, door, lamp: clamp(lamp), clockMin: clockAt(T), binders };
  };

  // captions: short phrases, broken at punctuation, never more than four words
  const captions: Prepared["captions"] = [];
  let cur: Array<{ w: string; t: number; end: number }> = [];
  for (const x of timing.words) {
    cur.push({ w: x.word, t: x.t, end: x.t + (x.end - x.start) });
    if (cur.length >= 4 || /[.,!?;:]$/.test(x.word)) {
      captions.push({
        words: cur,
        t0: (cur[0] as { t: number }).t,
        t1: (cur[cur.length - 1] as { end: number }).end + 0.2,
      });
      cur = [];
    }
  }
  if (cur.length)
    captions.push({
      words: cur,
      t0: (cur[0] as { t: number }).t,
      t1: (cur[cur.length - 1] as { end: number }).end + 0.2,
    });
  for (let i = 0; i + 1 < captions.length; i++)
    (captions[i] as { t1: number }).t1 = Math.min(
      (captions[i] as { t1: number }).t1 + 0.3,
      (captions[i + 1] as { t0: number }).t0,
    );

  return { plan, timing, shots, duration, issues, state, captions, absEvents };
}

// ------------------------------------------------------------------------------------ the camera

const HEIGHT = { wide: 2140, medium: 1250, close: 720, insert: 560, custom: 1400 } as const;

function cameraFor(w: W0Shot, perf: Performance | undefined, dur: number): (t: number) => Cam {
  const spec = w.cam;
  const framing = spec.framing ?? "medium";
  const h0 = spec.height ?? HEIGHT[framing];
  const resolve = (subject: string | undefined, t: number, height: number, sx: number, sy: number): Cam => {
    if (!subject || framing === "wide")
      return framing === "wide" && !subject
        ? { ...REF, height }
        : aimSubject(subject ?? "", t, height, sx, sy);
    return aimSubject(subject, t, height, sx, sy);
  };
  const aimSubject = (subject: string, t: number, height: number, sx: number, sy: number): Cam => {
    if (subject.startsWith("wall:")) {
      const [x = 0, y = 0] = subject.slice(5).split(",").map(Number);
      return aimAt(height, DEPTH.wall, x, y, sx * W, sy * H);
    }
    const actor = perf?.actors.get(subject);
    const set = officeSet();
    const p: [number, number] = actor
      ? actor.draw(t).head
      : ((set.targets[subject] as [number, number] | undefined) ?? [REF.cx, REF.cy]);
    return aimAt(height, 0, p[0], p[1], sx * W, sy * H);
  };
  const facing = (t: number): number => {
    const a = spec.subject ? perf?.actors.get(spec.subject) : undefined;
    return a ? a.facingAt(t) : 1;
  };
  const defSx = (t: number): number =>
    spec.sx ?? (framing === "close" || framing === "medium" ? 0.5 - 0.13 * facing(t) : 0.5);
  const defSy = spec.sy ?? (framing === "close" ? 0.42 : framing === "medium" ? 0.36 : 0.5);
  const clampCam = (c: Cam): Cam => {
    const height = Math.min(c.height, REF.height * 1.04);
    const vw = (height * W) / H;
    return {
      cx: clamp(c.cx, vw / 2 - 250, WORLD_W + 250 - vw / 2),
      cy: clamp(c.cy, height / 2 - 120, 2250 - height / 2),
      height,
    };
  };
  const start = resolve(spec.subject, 0, h0, defSx(0), defSy);
  return (t) => {
    const p = clamp(t / Math.max(0.1, dur));
    let c: Cam;
    switch (spec.move ?? "drift") {
      case "follow": {
        // an operator, not a lock: average the aim over the last 0.4 s
        let cx = 0,
          cy = 0;
        for (let k = 0; k <= 8; k++) {
          const s = Math.max(0, t - k * 0.05);
          const a = resolve(spec.subject, s, h0, defSx(s), defSy);
          cx += a.cx;
          cy += a.cy;
        }
        c = { cx: cx / 9, cy: cy / 9, height: h0 * (1 - 0.04 * p) };
        break;
      }
      case "travel": {
        const end = resolve(
          spec.to ?? spec.subject,
          dur,
          spec.toHeight ?? h0,
          spec.sx ?? 0.5,
          spec.sy ?? 0.5,
        );
        c = lerpCam(start, end, EASES.io(p));
        break;
      }
      case "push_in":
        c = { ...start, height: start.height * (1 - 0.14 * EASES.io(p)) };
        break;
      case "pull_out":
        c = { ...start, height: start.height * (0.88 + 0.12 * EASES.out(p)) };
        break;
      case "static":
        c = start;
        break;
      default:
        c = {
          cx: start.cx + 26 * p * facing(0),
          cy: start.cy - 10 * p,
          height: start.height * (1 - 0.05 * p),
        };
    }
    return clampCam(c);
  };
}

// ------------------------------------------------------------------------------------ rendering

const svgDoc = (body: string, defs = ""): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><defs>${DEFS}${defs}</defs><g transform="translate(${M} ${M})">${body}</g></svg>`,
  );

async function layer(body: string): Promise<Awaited<ReturnType<typeof loadImage>>> {
  return loadImage(svgDoc(body));
}

interface Surfaces {
  main: Canvas;
  L: Canvas;
  LM: Canvas;
  E: Canvas;
  grain: Canvas[];
}

let surfaces: Surfaces | undefined;
function surf(): Surfaces {
  if (surfaces) return surfaces;
  const grain = [0, 1, 2, 3].map((k) => {
    const g = createCanvas(384, 384);
    const gc = g.getContext("2d");
    const d = gc.createImageData(384, 384);
    let s = 1234567 + k * 7919;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    gc.putImageData(d, 0, 0);
    return g;
  });
  surfaces = {
    main: createCanvas(W, H),
    L: createCanvas(CW, CH),
    LM: createCanvas(CW, CH),
    E: createCanvas(CW, CH),
    grain,
  };
  return surfaces;
}

const rgba = (hex: string, a: number): string =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** How much each light source is on. */
function lights(st: PlaceState) {
  const golden = byLight(st.light, [0.35, 1, 0.35, 0]);
  const dark = byLight(st.light, [0, 0.2, 0.75, 1]);
  return {
    ambient: byLight(st.light, ["#FFFFFF", "#F6E2C8", "#A7A6C8", "#646FA0"]),
    golden,
    dark,
    lamp: st.lamp * (0.25 + 0.75 * dark),
    door: st.door,
  };
}

function radial(c: SKRSContext2D, x: number, y: number, r: number, col: string, a: number): void {
  if (a <= 0.003 || r <= 1) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.45, rgba(col, a * 0.45));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/** Multiply the layer in L by the light map, keeping L's own alpha. */
function lightLayer(img: Awaited<ReturnType<typeof loadImage>>, S: Surfaces, tint?: string): void {
  const l = S.L.getContext("2d");
  l.globalCompositeOperation = "source-over";
  l.globalAlpha = 1;
  l.filter = "none";
  l.clearRect(0, 0, CW, CH);
  l.drawImage(img, 0, 0);
  l.globalCompositeOperation = "multiply";
  l.drawImage(S.LM, 0, 0);
  if (tint) {
    l.fillStyle = tint;
    l.fillRect(0, 0, CW, CH);
  }
  l.globalCompositeOperation = "destination-in";
  l.drawImage(img, 0, 0);
  l.globalCompositeOperation = "source-over";
}

function drawL(ctx: SKRSContext2D, S: Surfaces, blur = 0, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(S.L, -M, -M);
  ctx.restore();
}

export async function renderFrame(P: Prepared, i: number, t: number): Promise<Canvas> {
  const S = surf();
  const ps = P.shots[i] as PreparedShot;
  await drawShot(S.main.getContext("2d"), S, P, ps, t);
  // transitions: a short cross-dissolve when the plan asks for one
  const tr = ps.w.shot.transition;
  const prev = P.shots[i - 1];
  if (prev && tr === "fade" && t < 0.5) {
    const snap = createCanvas(W, H);
    snap.getContext("2d").drawImage(S.main, 0, 0);
    await drawShot(S.main.getContext("2d"), S, P, prev, prev.dur + t);
    const ctx = S.main.getContext("2d");
    ctx.globalAlpha = EASES.io(t / 0.5);
    ctx.drawImage(snap, 0, 0);
    ctx.globalAlpha = 1;
  }
  overlays(S.main.getContext("2d"), P, ps, t, i);
  return S.main;
}

async function drawShot(
  ctx: SKRSContext2D,
  S: Surfaces,
  P: Prepared,
  ps: PreparedShot,
  t: number,
): Promise<void> {
  const T = ps.start + t;
  const cam = ps.cam(t);
  const st = P.state(T, ps.perf?.door.at(t) ?? 0, ps.light(t));
  const lt = lights(st);
  const pa = project(cam, 0);
  const pw = project(cam, DEPTH.wall);
  const sA = pa.s;
  const scr = (p: [number, number], pr = pa): [number, number] => {
    const [x, y] = toScreen(pr, p[0], p[1]);
    return [x + M, y + M];
  };
  const framing = ps.w.cam.framing ?? "medium";
  const onWall = (ps.w.cam.subject ?? "").startsWith("wall:");

  // ---- light map
  const lm = S.LM.getContext("2d");
  lm.globalCompositeOperation = "source-over";
  lm.fillStyle = lt.ambient;
  lm.fillRect(0, 0, CW, CH);
  lm.globalCompositeOperation = "lighter";
  const win = SPOTS.window;
  const [wx, wy] = scr([(win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2 + 200], pw);
  radial(lm, wx, wy, 1500 * pw.s, "#FFB872", 0.34 * lt.golden);
  const [lx, ly] = scr(SPOTS.lampHead);
  radial(lm, lx - 60 * sA, ly + 120 * sA, 1050 * sA, "#FFC37A", 0.95 * lt.lamp);
  const [mx, my] = scr(SPOTS.monitor);
  radial(lm, mx, my, 420 * sA, "#9CC9FF", 0.3 * lt.dark);
  const dr = SPOTS.door;
  const [dx, dy] = scr([(dr.x0 + dr.x1) / 2, 1250], pw);
  radial(lm, dx + 120 * sA, dy, 1300 * sA, "#FFE6BF", 0.95 * lt.door);
  lm.globalCompositeOperation = "source-over";

  // ---- sky and city (their colours already carry the time of day)
  const skyPr = project(cam, DEPTH.sky);
  const cityPr = project(cam, DEPTH.city);
  const nearCityPr = project(cam, DEPTH.cityNear);
  const skyImg = await layer(
    `<g transform="${svgTransform(skyPr)}">${skyLayer(st)}</g><g transform="${svgTransform(cityPr)}">${cityLayer(st, false, P.plan.world.seed)}</g><g transform="${svgTransform(nearCityPr)}">${cityLayer(st, true, P.plan.world.seed + 5)}</g>`,
  );
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0C1529";
  ctx.fillRect(0, 0, W, H);
  const dofWall =
    ps.w.dof?.wall ??
    (onWall ? 0 : framing === "wide" ? 0 : framing === "medium" ? 2.2 : framing === "close" ? 4.2 : 5.5);
  ctx.save();
  if (dofWall + 2 > 0.4) ctx.filter = `blur(${(dofWall + 2).toFixed(1)}px)`;
  ctx.drawImage(skyImg, -M, -M);
  ctx.restore();

  // ---- the wall plane
  const wallImg = await layer(`<g transform="${svgTransform(pw)}">${wallLayer(st, P.plan.world)}</g>`);
  lightLayer(wallImg, S, rgba(byLight(st.light, ["#FFFFFF", "#FFF4E6", "#E4E0F2", "#D8DCF0"]), 1));
  drawL(ctx, S, dofWall);

  // light shafts on the wall and floor from the low sun
  if (lt.golden > 0.02) {
    const a = scr([win.x0 + 40, win.y0 + 230], pw);
    const b = scr([win.x1, win.y0 + 230], pw);
    const c2 = scr([win.x1 - 900, 2150]);
    const d2 = scr([win.x0 - 1150, 2150]);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createLinearGradient(a[0], a[1], d2[0], d2[1]);
    g.addColorStop(0, rgba("#FFC98A", 0.26 * lt.golden));
    g.addColorStop(1, rgba("#FFC98A", 0));
    ctx.fillStyle = g;
    ctx.filter = "blur(18px)";
    ctx.beginPath();
    ctx.moveTo(a[0] - M, a[1] - M);
    ctx.lineTo(b[0] - M, b[1] - M);
    ctx.lineTo(c2[0] - M, c2[1] - M);
    ctx.lineTo(d2[0] - M, d2[1] - M);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- people (drawn now, used for shadows first)
  const perf = ps.perf;
  let actorsSvg = "";
  if (perf) {
    const held: string[] = [];
    const resting: string[] = [];
    for (const pr of perf.props.values()) {
      let holder: string | null = null;
      for (const e of pr.events) if (e.t <= t) holder = e.holder;
      const p = propAt(pr, t, perf.actors);
      if (holder) {
        const a = perf.actors.get(holder);
        held.push(drawProp(pr.kind, p[0], p[1] - 4, { facing: a?.facingAt(t) ?? 1 }));
      } else resting.push(drawProp(pr.kind, p[0], p[1], { resting: true }));
    }
    const people = [...perf.actors.values()].sort((a, b) => a.x.at(t) - b.x.at(t)).map((a) => a.draw(t).svg);
    actorsSvg = people.join("") + held.join("");
    // resting props belong to the furniture layer
    (ps as PreparedShot & { _resting?: string })._resting = resting.join("");
  }
  const restingSvg = (ps as PreparedShot & { _resting?: string })._resting ?? "";
  const actorImg = actorsSvg ? await layer(`<g transform="${svgTransform(pa)}">${actorsSvg}</g>`) : undefined;

  // cast shadows of people on the wall: away from the key light, soft
  if (actorImg) {
    const key = Math.max(lt.golden * 0.85, lt.lamp);
    const shA = 0.3 * key + 0.12 * lt.door;
    if (shA > 0.01) {
      const dir = lt.door > 0.3 ? 1 : -1;
      const e = S.E.getContext("2d");
      e.globalCompositeOperation = "source-over";
      e.clearRect(0, 0, CW, CH);
      e.drawImage(actorImg, 0, 0);
      e.globalCompositeOperation = "source-in";
      e.fillStyle = "#1B1530";
      e.fillRect(0, 0, CW, CH);
      e.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalAlpha = shA;
      ctx.filter = `blur(${(10 + dofWall).toFixed(1)}px)`;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(S.E, -M + dir * 95 * sA, -M - 30 * sA, CW, CH * 0.985);
      ctx.restore();
    }
  }

  // ---- furniture (same plane as the people)
  const midImg = await layer(
    `<g transform="${svgTransform(pa)}">${midLayer(st, P.plan.world)}${restingSvg}</g>`,
  );
  lightLayer(midImg, S);
  drawL(ctx, S, ps.w.dof?.mid ?? (onWall ? 4.5 : 0));

  // ---- people: lit, then a rim of light on the side that faces the key light
  if (actorImg) {
    lightLayer(actorImg, S);
    drawL(ctx, S, onWall ? 4.5 : 0);
    const rims: Array<{ dir: number; col: string; a: number }> = [
      { dir: 1, col: "#FFC88A", a: Math.max(lt.golden * 0.9, lt.lamp * 0.85) },
      { dir: -1, col: "#FFF1D6", a: lt.door },
    ];
    for (const r of rims) {
      if (r.a < 0.03) continue;
      const e = S.E.getContext("2d");
      const wpx = Math.max(3, 5 * sA);
      e.globalCompositeOperation = "source-over";
      e.clearRect(0, 0, CW, CH);
      e.drawImage(actorImg, 0, 0);
      e.globalCompositeOperation = "destination-out";
      e.drawImage(actorImg, -r.dir * wpx, wpx * 0.35);
      e.globalCompositeOperation = "source-in";
      e.fillStyle = r.col;
      e.fillRect(0, 0, CW, CH);
      e.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(1, r.a);
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(S.E, -M, -M);
      ctx.restore();
    }
  }

  // ---- near foreground, far out of focus
  if (ps.w.near) {
    const pn = project(cam, DEPTH.near);
    const nearImg = await layer(`<g transform="${svgTransform(pn)}">${nearLayer()}</g>`);
    lightLayer(nearImg, S, rgba("#B8B4C8", 1));
    drawL(ctx, S, 18);
  }

  // ---- bloom: the lamp bulb, the low sun in the window, the open door
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  radial(ctx, lx - M - 62 * sA, ly - M + 70 * sA, 260 * sA, "#FFD9A0", 0.7 * lt.lamp);
  radial(ctx, wx - M, wy - M - 160 * pw.s, 900 * pw.s, "#FFC27E", 0.28 * lt.golden);
  radial(ctx, dx - M, dy - M, 900 * sA, "#FFF1D6", 0.65 * lt.door);
  ctx.restore();
}

// ------------------------------------------------------------------------------------ type, captions, finish

function overlays(ctx: SKRSContext2D, P: Prepared, ps: PreparedShot, t: number, i: number): void {
  const S = surf();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.46, H * 0.78);
  v.addColorStop(0, "rgba(8,10,24,0)");
  v.addColorStop(1, "rgba(8,10,24,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // film grain
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.07;
  const g = S.grain[Math.floor((ps.start + t) * 24) % 4] as Canvas;
  const pat = ctx.createPattern(g, "repeat");
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  void i;
}

/** The type and the captions, as one SVG layer drawn last (Montserrat, like the rest of the show). */
export function typeSvg(P: Prepared, ps: PreparedShot, t: number): string {
  let o = "";
  const text = ps.w.shot.text;
  if (text && ps.textAt !== undefined) {
    const y = text.place === "bottom" ? 1300 : text.place === "center" ? 860 : 250;
    const a =
      clamp((t - ps.textAt + 0.2) / 0.5) * (ps.textOut !== undefined ? 1 - clamp((t - ps.textOut) / 0.4) : 1);
    if (a > 0.01)
      o += `<rect x="0" y="0" width="${W}" height="${text.place === "top" ? 760 : 1920}" fill="url(#scrimW0)" opacity="${a.toFixed(3)}"/>`;
    o += kineticType(t, text.lines, { y, at: ps.textAt, out: ps.textOut ?? null });
  }
  // captions: the phrase being spoken, the current word in the accent colour
  const T = ps.start + t;
  const cap = P.captions.find((c) => T >= c.t0 - 0.05 && T < c.t1);
  if (cap) {
    const inA = clamp((T - cap.t0 + 0.05) / 0.12);
    const words = cap.words.map((w) => ({ ...w, on: T >= w.t - 0.02 }));
    const line = words.map((w) => w.w).join(" ");
    const size = Math.min(58, Math.floor(1700 / Math.max(10, line.length)));
    const y = 1640;
    const spans = (stroke: boolean): string =>
      words
        .map((w) => {
          const nx = words[words.indexOf(w) + 1];
          const cur = T >= w.t - 0.02 && (nx ? T < nx.t - 0.02 : T < w.end + 0.25);
          const fill = stroke ? "#0C1529" : cur ? "#F4A261" : "#FBF6EC";
          return `<tspan fill="${fill}" fill-opacity="${stroke ? 0.9 : w.on ? 1 : 0.6}">${escapeXml(w.w)} </tspan>`;
        })
        .join("");
    const attrs = `x="${W / 2}" y="${y}" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="${size}"`;
    o += `<g opacity="${inA.toFixed(3)}"><text ${attrs} stroke="#0C1529" stroke-width="12" stroke-linejoin="round" stroke-opacity=".9">${spans(true)}</text><text ${attrs}>${spans(false)}</text></g>`;
  }
  return o;
}

const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const TYPE_DEFS = `<linearGradient id="scrimW0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity=".82"/><stop offset=".7" stop-color="#0C1529" stop-opacity=".35"/><stop offset="1" stop-color="#0C1529" stop-opacity="0"/></linearGradient>`;

void ramp;
